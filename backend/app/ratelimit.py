"""
Rate limiting middleware using in-memory token bucket.

Limits:
- 60 requests per minute per IP for general endpoints
- 10 requests per minute per IP for auth endpoints (login, register)
- 5 requests per minute per IP for billing/checkout endpoints

Uses a simple in-memory store (resets on restart). For production
at scale, swap to Redis-backed rate limiting.
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, JSONResponse


class RateLimitEntry:
    __slots__ = ("tokens", "last_refill")
    
    def __init__(self, max_tokens: int):
        self.tokens = max_tokens
        self.last_refill = time.monotonic()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter."""
    
    def __init__(self, app, general_rpm: int = 60, auth_rpm: int = 10, billing_rpm: int = 5):
        super().__init__(app)
        self.general_rpm = general_rpm
        self.auth_rpm = auth_rpm
        self.billing_rpm = billing_rpm
        self.buckets: dict[str, RateLimitEntry] = defaultdict(lambda: RateLimitEntry(general_rpm))
    
    def _get_limit(self, path: str) -> int:
        if "/auth/" in path or "/login" in path or "/register" in path:
            return self.auth_rpm
        if "/billing/" in path or "/checkout" in path:
            return self.billing_rpm
        return self.general_rpm
    
    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip non-API and OPTIONS requests
        if not request.url.path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        path = request.url.path
        limit = self._get_limit(path)
        
        bucket_key = f"{client_ip}:{limit}"
        
        now = time.monotonic()
        bucket = self.buckets[bucket_key]
        
        # Refill tokens based on elapsed time
        elapsed = now - bucket.last_refill
        tokens_to_add = elapsed * (limit / 60.0)  # tokens per second
        bucket.tokens = min(limit, bucket.tokens + tokens_to_add)
        bucket.last_refill = now
        
        if bucket.tokens < 1:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please try again later."},
                headers={
                    "Retry-After": str(int(60 / limit)),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )
        
        bucket.tokens -= 1
        
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket.tokens))
        return response
