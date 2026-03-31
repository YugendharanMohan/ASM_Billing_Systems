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
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, JSONResponse


class RateLimitEntry:
    __slots__ = ("tokens", "last_refill", "max_tokens")
    
    def __init__(self, max_tokens: int):
        self.max_tokens = max_tokens
        self.tokens = max_tokens
        self.last_refill = time.monotonic()


# Cleanup interval: evict stale entries every 5 minutes
_CLEANUP_INTERVAL = 300
# Entries older than 10 minutes are stale
_STALE_THRESHOLD = 600


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter with periodic cleanup."""
    
    def __init__(self, app, general_rpm: int = 60, auth_rpm: int = 10, billing_rpm: int = 5):
        super().__init__(app)
        self.general_rpm = general_rpm
        self.auth_rpm = auth_rpm
        self.billing_rpm = billing_rpm
        self.buckets: dict[str, RateLimitEntry] = {}
        self._last_cleanup = time.monotonic()
    
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
    
    def _cleanup_stale_entries(self):
        """Evicts bucket entries that haven't been accessed recently."""
        now = time.monotonic()
        if now - self._last_cleanup < _CLEANUP_INTERVAL:
            return
        
        self._last_cleanup = now
        stale_keys = [
            key for key, entry in self.buckets.items()
            if now - entry.last_refill > _STALE_THRESHOLD
        ]
        for key in stale_keys:
            del self.buckets[key]
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Skip non-API and OPTIONS requests
        if not request.url.path.startswith("/api/") or request.method == "OPTIONS":
            return await call_next(request)
        
        # Periodic cleanup of stale entries
        self._cleanup_stale_entries()
        
        client_ip = self._get_client_ip(request)
        path = request.url.path
        limit = self._get_limit(path)
        
        bucket_key = f"{client_ip}:{limit}"
        
        now = time.monotonic()
        
        # Create bucket with correct limit if it doesn't exist
        if bucket_key not in self.buckets:
            self.buckets[bucket_key] = RateLimitEntry(limit)
        
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
