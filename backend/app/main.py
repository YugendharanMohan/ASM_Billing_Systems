import os
# Force gRPC to use the system's native DNS resolver
os.environ["GRPC_DNS_RESOLVER"] = "native"

# Load .env variables into os.environ BEFORE any module reads them
from dotenv import load_dotenv
load_dotenv()
# --------------------------------------------------
# IMPORTS
# --------------------------------------------------    

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import db 
from .auth import (
    org_admin_required, owner_required, set_user_claims,
    enforce_plan_limits, super_admin_required, operator_self_only,
    router as auth_router, SUPER_ADMIN_EMAIL,
    get_current_user, get_current_org
)
from .crud import crud
from .schemas import (
    WorkerCreate, WorkerUpdate, ProductionUpdate,
    OrganizationCreate, OrganizationUpdate, InviteMember, MemberUpdate
)
from .salary import router as salary_router
from .billing import router as billing_router
from .attendance import router as attendance_router
from .expenses import router as expenses_router
from .inventory import router as inventory_router
from .orders import router as orders_router
from .analytics import router as analytics_router
from .email import send_invite_email
from .payroll import router as payroll_router
from .audit import AuditLogMiddleware, get_audit_log
from .ratelimit import RateLimitMiddleware
from firebase_admin import auth as firebase_auth

# --------------------------------------------------
# APP INITIALIZATION
# --------------------------------------------------
app = FastAPI(title="ASM Loom Management - SaaS Edition")

# --------------------------------------------------
# CORS (REQUIRED FOR REACT & VERCEL)
# --------------------------------------------------
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# SECURITY MIDDLEWARE
# --------------------------------------------------
app.add_middleware(AuditLogMiddleware)
app.add_middleware(RateLimitMiddleware, general_rpm=60, auth_rpm=10, billing_rpm=5)

# --------------------------------------------------
# INCLUDE ROUTERS
# --------------------------------------------------
app.include_router(auth_router, prefix="/api/v1")
app.include_router(salary_router, prefix="/api/v1", tags=["Salary & Production"])
app.include_router(billing_router, prefix="/api/v1", tags=["Billing"])
app.include_router(attendance_router, prefix="/api/v1", tags=["Attendance & Leave"])
app.include_router(expenses_router, prefix="/api/v1", tags=["Expenses"])
app.include_router(inventory_router, prefix="/api/v1", tags=["Inventory"])
app.include_router(orders_router, prefix="/api/v1", tags=["Orders"])
app.include_router(analytics_router, prefix="/api/v1", tags=["Analytics & Export"])
app.include_router(payroll_router, prefix="/api/v1", tags=["Payroll"])

# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "database": "firestore", "version": "2.0.0-saas"}

# ==================================================
# ORGANIZATION ENDPOINTS
# ==================================================

@app.post("/api/v1/organizations/", tags=["Organizations"])
def create_organization(
    org_data: OrganizationCreate,
    user=Depends(get_current_user)
):
    """
    Creates a new organization and sets the current user as Owner.
    The user's Firebase custom claims are updated with org_id and role.
    """
    uid = user.get("uid")
    email = user.get("email")
    
    # Check if user already belongs to an org
    existing_org_id = user.get("org_id")
    if existing_org_id:
        raise HTTPException(
            status_code=400,
            detail="You already belong to an organization. Leave your current org first."
        )
    
    result = crud.create_organization(org_data.dict(), owner_uid=uid, owner_email=email)
    
    # Set Firebase custom claims so the token includes org_id
    set_user_claims(uid, org_id=result["id"], role="Owner")
    
    return result


@app.get("/api/v1/organizations/me", tags=["Organizations"])
def get_my_organization(ctx=Depends(get_current_org)):
    """Returns the current user's organization details."""
    org = crud.get_organization(ctx["org_id"])
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@app.put("/api/v1/organizations/me", tags=["Organizations"])
def update_my_organization(
    data: OrganizationUpdate,
    ctx=Depends(org_admin_required)
):
    """Updates the current org's details. Requires Admin or Owner role."""
    updated = crud.update_organization(ctx["org_id"], data.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Organization not found")
    return updated


# --------------------------------------------------
# MEMBER MANAGEMENT
# --------------------------------------------------

@app.get("/api/v1/organizations/members", tags=["Members"])
def list_members(ctx=Depends(get_current_org)):
    """Lists all members of the current organization."""
    return crud.get_org_members(ctx["org_id"])


@app.post("/api/v1/organizations/members/invite", tags=["Members"])
def invite_member(
    invite: InviteMember,
    ctx=Depends(owner_required)
):
    """
    Creates a supervisor account with email/password and adds them to the org.
    Requires Owner role.
    """
    org_id = ctx["org_id"]
    
    # Check if the user already exists in Firebase
    try:
        firebase_user = firebase_auth.get_user_by_email(invite.email)
        uid = firebase_user.uid
        
        # Check if user already has an org
        existing_claims = firebase_user.custom_claims or {}
        if existing_claims.get("org_id"):
            raise HTTPException(
                status_code=400,
                detail=f"{invite.email} already belongs to another organization."
            )
    except firebase_auth.UserNotFoundError:
        # Create the user in Firebase with the provided password
        firebase_user = firebase_auth.create_user(
            email=invite.email,
            password=invite.password,
            email_verified=True,
            display_name=invite.name,
        )
        uid = firebase_user.uid
    
    # Set custom claims
    set_user_claims(uid, org_id=org_id, role=invite.role)
    
    # Add to org members collection
    result = crud.add_member(org_id, uid=uid, email=invite.email, role=invite.role, name=invite.name)
    
    # --------------------------------------------------
    # SEND INVITATION EMAIL
    # --------------------------------------------------
    email_sent = False
    try:
        # Generate Firebase password-reset link so the user can set their password
        reset_link = firebase_auth.generate_password_reset_link(invite.email)
        
        # Get org name for the email
        org_doc = db.collection("organizations").document(org_id).get()
        org_name = org_doc.to_dict().get("name", "Your Organization") if org_doc.exists else "Your Organization"
        
        email_sent = send_invite_email(
            to_email=invite.email,
            org_name=org_name,
            role=invite.role,
            password_reset_link=reset_link,
        )
    except Exception as e:
        # Email is best-effort — don't fail the invite if email fails
        import logging
        logging.getLogger(__name__).error(f"Failed to send invite email: {e}")
    
    return {
        "message": f"Invited {invite.email} as {invite.role}",
        "email_sent": email_sent,
        **result
    }


@app.put("/api/v1/organizations/members/{member_uid}", tags=["Members"])
def update_member_role(
    member_uid: str,
    data: MemberUpdate,
    ctx=Depends(owner_required)
):
    """Changes a member's role. Only the Owner can do this."""
    org_id = ctx["org_id"]
    
    # Can't demote yourself
    if member_uid == ctx["uid"]:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")
    
    result = crud.update_member_role(org_id, member_uid, data.role)
    if not result:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Update Firebase custom claims
    set_user_claims(member_uid, org_id=org_id, role=data.role)
    
    return result


@app.delete("/api/v1/organizations/members/{member_uid}", tags=["Members"])
def remove_member(
    member_uid: str,
    ctx=Depends(owner_required)
):
    """Removes a member from the org. Only the Owner can do this."""
    org_id = ctx["org_id"]
    
    if member_uid == ctx["uid"]:
        raise HTTPException(status_code=400, detail="You cannot remove yourself. Transfer ownership first.")
    
    success = crud.remove_member(org_id, member_uid)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Clear their custom claims
    firebase_auth.set_custom_user_claims(member_uid, {"org_id": None, "org_role": None})
    
    return {"status": "removed"}


# ==================================================
# WORKERS (org-scoped)
# ==================================================

@app.post("/api/v1/workers/", tags=["Workers"])
def create_worker(worker: WorkerCreate, ctx=Depends(enforce_plan_limits("workers"))):
    """Creates a worker in the org. Checks plan limits."""
    return crud.create_worker(ctx["org_id"], worker.dict())


@app.get("/api/v1/workers/", tags=["Workers"])
def list_workers(ctx=Depends(get_current_org)):
    """Fetches all workers in the current org."""
    return crud.get_workers(ctx["org_id"])


@app.put("/api/v1/workers/{worker_id}", tags=["Workers"])
def update_worker_endpoint(worker_id: str, worker: WorkerUpdate, ctx=Depends(org_admin_required)):
    updated = crud.update_worker(ctx["org_id"], worker_id, worker.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Worker not found")
    return updated


@app.delete("/api/v1/workers/{worker_id}", tags=["Workers"])
def delete_worker_endpoint(worker_id: str, ctx=Depends(org_admin_required)):
    success = crud.delete_worker(ctx["org_id"], worker_id)
    if not success:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"status": "deleted"}


# ==================================================
# SHEDS & LOOMS (org-scoped)
# ==================================================

@app.post("/api/v1/sheds/", tags=["Sheds & Looms"])
def add_shed(name: str, ctx=Depends(enforce_plan_limits("sheds"))):
    """Creates a shed. Checks plan limits."""
    return crud.create_shed(ctx["org_id"], name)


@app.get("/api/v1/sheds-looms/", tags=["Sheds & Looms"])
def get_shed_hierarchy(ctx=Depends(get_current_org)):
    return crud.get_hierarchy(ctx["org_id"])


@app.post("/api/v1/looms/", tags=["Sheds & Looms"])
def add_loom(shed_id: str, loom_num: str, ctx=Depends(org_admin_required)):
    return crud.create_loom(ctx["org_id"], shed_id, loom_num)


# ==================================================
# PRODUCTION REPORTS (org-scoped)
# ==================================================

@app.get("/api/v1/production/history", tags=["Production"])
def get_history(start_date: str, end_date: str, worker_id: str = None, ctx=Depends(get_current_org)):
    return crud.get_production_history(ctx["org_id"], start_date, end_date, worker_id)


@app.get("/api/v1/production/analytics", tags=["Production"])
def get_analytics_endpoint(start_date: str, end_date: str, ctx=Depends(get_current_org)):
    return crud.get_analytics(ctx["org_id"], start_date, end_date)


# ==================================================
# PRODUCTION ENTRY MANAGEMENT (org-scoped)
# ==================================================

@app.delete("/api/v1/production/{entry_id}", tags=["Production"])
def delete_production_entry(entry_id: str, ctx=Depends(org_admin_required)):
    success = crud.delete_production(ctx["org_id"], entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"status": "success", "message": "Entry deleted"}


@app.put("/api/v1/production/{entry_id}", tags=["Production"])
def update_production_entry(entry_id: str, updates: ProductionUpdate, ctx=Depends(org_admin_required)):
    update_data = updates.dict(exclude_unset=True)
    updated_record = crud.update_production(ctx["org_id"], entry_id, update_data)
    if not updated_record:
        raise HTTPException(status_code=404, detail="Entry not found")
    return updated_record


# ==================================================
# SAAS ADMIN ENDPOINTS (Super Admin only)
# ==================================================

@app.get("/api/v1/admin/organizations", tags=["SaaS Admin"])
def list_all_organizations(user=Depends(super_admin_required)):
    """Lists ALL organizations across the platform. Super Admin only."""
    orgs = db.collection("organizations").stream()
    return [{"id": org.id, **org.to_dict()} for org in orgs]


@app.put("/api/v1/admin/organizations/{target_org_id}/disable", tags=["SaaS Admin"])
def disable_organization(target_org_id: str, user=Depends(super_admin_required)):
    """Disables a company's account. Super Admin only."""
    org_ref = db.collection("organizations").document(target_org_id)
    if not org_ref.get().exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_ref.update({"is_active": False})
    return {"status": "disabled", "org_id": target_org_id}


@app.put("/api/v1/admin/organizations/{target_org_id}/enable", tags=["SaaS Admin"])
def enable_organization(target_org_id: str, user=Depends(super_admin_required)):
    """Re-enables a company's account. Super Admin only."""
    org_ref = db.collection("organizations").document(target_org_id)
    if not org_ref.get().exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    org_ref.update({"is_active": True})
    return {"status": "enabled", "org_id": target_org_id}


# ==================================================
# OPERATOR SELF-VIEW PORTAL
# ==================================================

@app.get("/api/v1/me/production", tags=["Operator Portal"])
def my_production(start_date: str, end_date: str, ctx=Depends(operator_self_only)):
    """Returns production history for the logged-in operator's linked worker only."""
    worker_id = ctx.get("forced_worker_id")
    return crud.get_production_history(ctx["org_id"], start_date, end_date, worker_id)


@app.get("/api/v1/me/analytics", tags=["Operator Portal"])
def my_analytics(start_date: str, end_date: str, ctx=Depends(operator_self_only)):
    """Returns analytics for the logged-in operator's linked worker only."""
    worker_id = ctx.get("forced_worker_id")
    # Re-use production history but filter to self
    history = crud.get_production_history(ctx["org_id"], start_date, end_date, worker_id)
    total_meters = sum(r.get("meters", 0) for r in history)
    total_earnings = sum(r.get("total_amount", 0) for r in history)
    return {
        "total_meters": total_meters,
        "total_earnings": total_earnings,
        "entries": len(history),
        "history": history,
    }