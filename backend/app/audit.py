"""
Audit logging middleware.

Logs every mutating API call (POST, PUT, DELETE) to Firestore:
    organizations/{orgId}/audit_log/{id}

Each entry records: who, what endpoint, method, timestamp, request summary.
"""

from datetime import datetime
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .database import db


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Logs all mutating requests (POST/PUT/DELETE) to Firestore audit_log."""
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Only log mutating methods
        if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
            return await call_next(request)
        
        # Skip non-API and health check routes
        path = request.url.path
        if not path.startswith("/api/") or path.endswith("/health"):
            return await call_next(request)
        
        # Execute the request first
        response = await call_next(request)
        
        # Only log successful mutations
        if response.status_code >= 400:
            return response
        
        try:
            # Extract org context from request state (set by auth middleware)
            org_id = getattr(request.state, "org_id", None)
            user_email = getattr(request.state, "user_email", None)
            user_uid = getattr(request.state, "user_uid", None)
            
            if not org_id:
                return response
            
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "path": path,
                "user_uid": user_uid or "",
                "user_email": user_email or "",
                "status_code": response.status_code,
                "query_params": dict(request.query_params),
            }
            
            # Write to Firestore async-safe (fire and forget)
            db.collection("organizations").document(org_id) \
                .collection("audit_log").document().set(log_entry)
        except Exception:
            # Never let audit logging break the app
            pass
        
        return response


def get_audit_log(org_id: str, limit: int = 50):
    """Retrieves recent audit log entries."""
    docs = db.collection("organizations").document(org_id) \
        .collection("audit_log") \
        .order_by("timestamp", direction="DESCENDING") \
        .limit(limit) \
        .stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]
