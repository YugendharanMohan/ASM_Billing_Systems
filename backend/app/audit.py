"""
Audit logging middleware.

Logs every mutating API call (POST, PUT, DELETE) to Firestore:
    organizations/{orgId}/audit_log/{id}

Each entry records: who, what endpoint, method, timestamp, request summary.

The middleware extracts org context from the Authorization header by decoding
the Firebase ID token. This is necessary because FastAPI Depends() is
function-level and doesn't populate request.state.
"""

from datetime import datetime
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .database import db


def _extract_org_context(token_str: str) -> dict:
    """
    Decodes a Firebase ID token to extract org_id, email, uid.
    Returns empty dict on failure (never blocks the request).
    """
    try:
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(token_str)
        return {
            "org_id": decoded.get("org_id"),
            "email": decoded.get("email", ""),
            "uid": decoded.get("uid", ""),
        }
    except Exception:
        return {}


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
        
        # Extract org context from Authorization header BEFORE the request
        org_ctx = {}
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token_str = auth_header[7:]
            org_ctx = _extract_org_context(token_str)
        
        # Execute the request
        response = await call_next(request)
        
        # Only log successful mutations
        if response.status_code >= 400:
            return response
        
        org_id = org_ctx.get("org_id")
        if not org_id:
            return response
        
        try:
            log_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "path": path,
                "user_uid": org_ctx.get("uid", ""),
                "user_email": org_ctx.get("email", ""),
                "status_code": response.status_code,
                "query_params": dict(request.query_params),
            }
            
            # Write to Firestore (fire and forget)
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
