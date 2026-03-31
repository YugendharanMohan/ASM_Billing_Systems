import os
import requests
from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from firebase_admin import auth as firebase_auth

# Ensure Firebase is initialized (handled by firebase_admin.py via database.py import)
from .database import db  # noqa: F401

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------
SUPER_ADMIN_EMAIL = ["yugendharanmohan@gmail.com", "mohanas510@gmail.com", "jeevankumaram25@gmail.com"]

# Read from environment variable (set in .env or hosting platform)
FIREBASE_WEB_API_KEY = os.environ.get("FIREBASE_WEB_API_KEY", "")

# Role hierarchy (higher index = more permissions)
ROLE_HIERARCHY = {
    "Supervisor": 1,
    "Owner": 3,
}

# --------------------------------------------------
# AUTH ROUTER & LOGIN LOGIC
# --------------------------------------------------
router = APIRouter()

# 1. DEFINE THE SCHEME
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# 2. LOGIN ENDPOINT (Kept for Swagger UI testing)
@router.post("/auth/login", tags=["Authentication"])
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Exchanges Email/Password for a Firebase ID Token.
    Used by Swagger UI 'Authorize' button automatically.
    Frontend now uses Firebase JS SDK directly.
    """
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
    payload = {
        "email": form_data.username,
        "password": form_data.password,
        "returnSecureToken": True
    }
    
    response = requests.post(url, json=payload)
    data = response.json()

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Login Failed: {data.get('error', {}).get('message', 'Unknown error')}"
        )

    return {"access_token": data["idToken"], "token_type": "bearer"}

# --------------------------------------------------
# CORE DEPENDENCIES
# --------------------------------------------------

def verify_firebase_token(token: str = Depends(oauth2_scheme)):
    """Decodes and verifies the Firebase ID token."""
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(user=Depends(verify_firebase_token)):
    """Returns the decoded Firebase token (user info)."""
    return user


# --------------------------------------------------
# GET ME & REGISTER ENDPOINTS
# --------------------------------------------------

@router.get("/auth/me", tags=["Authentication"])
def get_me(user=Depends(verify_firebase_token)):
    """Returns the current user's info derived from their Firebase ID token."""
    email = user.get("email", "")
    is_super = email in SUPER_ADMIN_EMAIL
    is_admin_claim = user.get("admin", False)
    org_role = user.get("org_role", "Operator")
    
    # Determine display role (backwards compatible with frontend)
    if is_admin_claim or is_super:
        role = "Admin"
    elif org_role in ("Owner", "Admin"):
        role = "Admin"
    else:
        role = "User"
    
    return {
        "status": "Authenticated",
        "uid": user.get("uid"),
        "email": email,
        "role": role,
        "org_role": org_role,
        "org_id": user.get("org_id"),
        "is_super_admin": is_super,
    }


from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name: str
    role: str = "Operator"

@router.post("/auth/register", tags=["Authentication"])
def register_user(payload: RegisterRequest, user=Depends(verify_firebase_token)):
    """
    Saves the new user's profile (name, role) to Firestore.
    Called right after Firebase createUserWithEmailAndPassword on the frontend.
    
    Self-registration is ALWAYS as 'Owner' — the user will create their
    organization in the next step (onboarding). Admins and Operators
    are added exclusively through the invite_member endpoint.
    """
    uid = user.get("uid")
    email = user.get("email", "")
    
    # Self-registration is always Owner; ignore client-sent role
    role = "Owner"
    
    # Store user profile in Firestore
    db.collection("users").document(uid).set({
        "uid": uid,
        "email": email,
        "name": payload.name,
        "role": role,
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }, merge=True)
    
    return {
        "uid": uid,
        "email": email,
        "name": payload.name,
        "role": role,
        "org_role": role,
        "org_id": None,
    }


# --------------------------------------------------
# ORGANIZATION CONTEXT
# --------------------------------------------------

def get_current_org(
    user=Depends(verify_firebase_token),
    impersonate_org_id: str = Query(None, alias="org_id"),
):
    """
    Extracts the user's organization ID from Firebase custom claims.
    Super admins can pass ?org_id=xxx to impersonate any organization.
    
    Returns: dict with 'org_id', 'role', 'uid', 'email', 'is_super_admin'
    """
    org_id = user.get("org_id")
    role = user.get("org_role", "Operator")
    email = user.get("email", "")
    is_super = email in SUPER_ADMIN_EMAIL
    
    # Super Admin impersonation: override org_id if provided
    if is_super:
        if impersonate_org_id:
            org_id = impersonate_org_id
        # Super admin gets Owner-level access when impersonating
        return {
            "org_id": org_id,
            "role": "Owner",
            "uid": user.get("uid"),
            "email": email,
            "is_super_admin": True,
        }
    
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of any organization. Please contact your admin or create an organization."
        )
    
    return {
        "org_id": org_id,
        "role": role,
        "uid": user.get("uid"),
        "email": email,
        "is_super_admin": False,
    }


# --------------------------------------------------
# ROLE-BASED ACCESS CONTROL
# --------------------------------------------------

def _check_role(user_ctx: dict, min_role: str):
    """Internal: checks if the user's role meets the minimum required role."""
    email = user_ctx.get("email", "")
    
    # Super admins bypass role checks
    if email in SUPER_ADMIN_EMAIL:
        return user_ctx
    
    user_role = user_ctx.get("role", "Operator")
    if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(min_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires {min_role} role or higher."
        )
    return user_ctx


def admin_required(user=Depends(verify_firebase_token)):
    """
    Dependency: requires Admin or Owner role.
    Also works for super admin emails (backwards compatible).
    """
    email = user.get("email", "")
    is_admin_claim = user.get("admin", False)
    org_role = user.get("org_role", "Operator")
    
    # Backwards compatible: check old admin claim + super admin emails
    if is_admin_claim or email in SUPER_ADMIN_EMAIL:
        return user
    
    # New: check org role
    if ROLE_HIERARCHY.get(org_role, 0) >= ROLE_HIERARCHY.get("Admin", 2):
        return user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access denied for {email}. Admin rights required."
    )


def owner_required(ctx=Depends(get_current_org)):
    """Dependency: requires Owner role."""
    return _check_role(ctx, "Owner")


def org_admin_required(ctx=Depends(get_current_org)):
    """Dependency: requires Admin role or higher within the org."""
    return _check_role(ctx, "Admin")


def super_admin_required(user=Depends(verify_firebase_token)):
    """Dependency: requires Super Admin (SaaS owner) access."""
    if user.get("email", "") not in SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required."
        )
    return user


def operator_self_only(ctx=Depends(get_current_org)):
    """
    Row-level security for Operators.
    For Operators: looks up their linked worker document and forces
    'forced_worker_id' to match. Checks both UID-based and query-based lookups.
    For Admin+: passes through with no filter.
    """
    if ctx.get("role") == "Operator":
        uid = ctx["uid"]
        org_id = ctx["org_id"]
        
        # Try UID-based document first (invited members)
        member_ref = db.collection("organizations").document(org_id) \
            .collection("members").document(uid)
        member_doc = member_ref.get()
        
        if member_doc.exists:
            ctx["forced_worker_id"] = uid
        else:
            # Fallback: query by email for manually-created workers
            email = ctx.get("email", "")
            if email:
                members = db.collection("organizations").document(org_id) \
                    .collection("members") \
                    .where("email", "==", email) \
                    .limit(1).stream()
                for m in members:
                    ctx["forced_worker_id"] = m.id
                    break
                else:
                    ctx["forced_worker_id"] = uid  # Fallback to uid
            else:
                ctx["forced_worker_id"] = uid
    return ctx

# --------------------------------------------------
# HELPER: Set custom claims on a Firebase user
# --------------------------------------------------

def set_user_claims(uid: str, org_id: str, role: str):
    """
    Sets Firebase custom claims for organization + role.
    This is the source of truth for org_id and org_role.
    """
    claims = {
        "org_id": org_id,
        "org_role": role,
    }
    firebase_auth.set_custom_user_claims(uid, claims)


# --------------------------------------------------
# PLAN ENFORCEMENT MIDDLEWARE
# --------------------------------------------------

def enforce_plan_limits(resource_type: str):
    """
    Returns a FastAPI dependency that checks plan limits before resource creation.
    
    Usage:
        @app.post("/api/v1/workers/")
        def create_worker(worker: WorkerCreate, ctx=Depends(enforce_plan_limits("workers"))):
            ...
    
    resource_type: "workers", "sheds", "members", "production"
    """
    from .crud import crud as _crud
    from .plans import get_plan_limits, get_effective_plan

    def _enforce(ctx=Depends(get_current_org)):
        org_id = ctx["org_id"]
        email = ctx.get("email", "")
        
        # Super admins bypass limits
        if email in SUPER_ADMIN_EMAIL:
            return ctx
        
        sub = _crud.get_subscription(org_id)
        effective_plan = get_effective_plan(sub)
        limits = get_plan_limits(effective_plan)
        usage = _crud.get_usage(org_id)
        
        limit_checks = {
            "workers": (usage["workers"], limits.max_workers, "workers"),
            "sheds": (usage["sheds"], limits.max_sheds, "sheds"),
            "members": (usage["members"], limits.max_members, "team members"),
            "production": (
                usage["production_entries_this_month"],
                limits.max_production_entries_per_month,
                "production entries this month",
            ),
        }
        
        if resource_type in limit_checks:
            current, maximum, label = limit_checks[resource_type]
            if current >= maximum:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Plan limit reached: {current}/{maximum} {label}. "
                           f"Upgrade to add more.",
                )
        
        return ctx
    
    return _enforce