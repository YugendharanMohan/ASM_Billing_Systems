import os
# Force gRPC to use the system's native DNS resolver
os.environ["GRPC_DNS_RESOLVER"] = "native"
# --------------------------------------------------
# IMPORTS
# --------------------------------------------------    

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Updated Imports: Including get_current_user for role management
from .database import db 
from .auth import (admin_required, get_current_user, router as auth_router, SUPER_ADMIN_EMAIL)
from .crud import crud
from .schemas import WorkerCreate, WorkerUpdate, ProductionUpdate 
from .salary import router as salary_router

# --------------------------------------------------
# APP INITIALIZATION
# --------------------------------------------------
app = FastAPI(title="ASM Loom Management - Firestore Edition")

# --------------------------------------------------
# CORS (REQUIRED FOR REACT & VERCEL)
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# INCLUDE ROUTERS
# --------------------------------------------------

# Connects the new Login endpoint
app.include_router(auth_router, prefix="/api/v1")

# Connects production entry and salary logic
app.include_router(salary_router, prefix="/api/v1", tags=["Salary & Production"])

# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "database": "firestore"}

# --------------------------------------------------
# AUTH TEST ENDPOINT (Use this to test Admin vs User)
# --------------------------------------------------
@app.get("/api/v1/auth/me", tags=["Authentication"])
def get_my_role(user=Depends(get_current_user)):
    """
    Returns the current user's role info.
    Accessible by ANY logged-in user.
    """
    email = user.get("email")
    is_admin_claim = user.get("admin", False)
    
    # Simple logic to determine what we call them
    # Note: 'yugendharanmohan@gmail.com' is hardcoded as super admin in auth.py
    role = "Admin" if (is_admin_claim or email in SUPER_ADMIN_EMAIL) else "User"
    
    return {
        "status": "Authenticated",
        "email": email,
        "role": role,
        "uid": user.get("uid")
    }

# --------------------------------------------------
# WORKERS
# --------------------------------------------------
@app.post("/api/v1/workers/")
def create_worker(
    worker: WorkerCreate,
    admin=Depends(admin_required) # Security check: Only Admins can create
):
    """Creates a worker in the 'workers' collection."""
    return crud.create_worker(worker.dict())

@app.get("/api/v1/workers/")
def list_workers(
    user=Depends(get_current_user) # CHANGED: Regular users can now VIEW workers
):
    """Fetches all worker documents."""
    return crud.get_workers()

# --------------------------------------------------
# SHEDS & LOOMS
# --------------------------------------------------
@app.post("/api/v1/sheds/")
def add_shed(
    name: str,
    admin=Depends(admin_required) # Security check: Only Admins can create
):
    """Creates a new Shed document."""
    return crud.create_shed(name)

@app.get("/api/v1/sheds-looms/")
def get_shed_hierarchy(
    user=Depends(get_current_user) # CHANGED: Regular users can VIEW hierarchy
):
    """Returns sheds with their nested looms sub-collection."""
    return crud.get_hierarchy()

@app.post("/api/v1/looms/")
def add_loom(
    shed_id: str, # Firestore IDs are strings
    loom_num: str,
    admin=Depends(admin_required) # Security check: Only Admins can create
):
    """Adds a loom document to a specific shed's sub-collection."""
    return crud.create_loom(shed_id, loom_num)

# --------------------------------------------------
# NEW: WORKER EDIT / DELETE
# --------------------------------------------------
@app.put("/api/v1/workers/{worker_id}")
def update_worker_endpoint(worker_id: str, worker: WorkerUpdate, user=Depends(get_current_user)):
    # Optional: Add admin_required dependency if needed
    updated = crud.update_worker(worker_id, worker.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Worker not found")
    return updated

@app.delete("/api/v1/workers/{worker_id}")
def delete_worker_endpoint(worker_id: str, user=Depends(admin_required)): # STRICT: Only Admin
    success = crud.delete_worker(worker_id)
    if not success:
         raise HTTPException(status_code=404, detail="Worker not found")
    return {"status": "deleted"}

# --------------------------------------------------
# NEW: PRODUCTION REPORTS
# --------------------------------------------------
@app.get("/api/v1/production/history")
def get_history(start_date: str, end_date: str, worker_id: str = None, user=Depends(get_current_user)):
    return crud.get_production_history(start_date, end_date, worker_id)

@app.get("/api/v1/production/analytics")
def get_analytics_endpoint(start_date: str, end_date: str, user=Depends(get_current_user)):
    return crud.get_analytics(start_date, end_date)

# --------------------------------------------------
# NEW: PRODUCTION ENTRY MANAGEMENT (EDIT/DELETE)
# --------------------------------------------------
@app.delete("/api/v1/production/{entry_id}")
def delete_production_entry(entry_id: str, user=Depends(get_current_user)):
    """
    Deletes a production entry.
    Allowed for any logged-in user to fix mistakes.
    """
    success = crud.delete_production(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"status": "success", "message": "Entry deleted"}

@app.put("/api/v1/production/{entry_id}")
def update_production_entry(entry_id: str, updates: ProductionUpdate, user=Depends(get_current_user)):
    """
    Updates a production entry (Meters/Shift).
    Recalculates earnings automatically.
    """
    # Convert Pydantic model to dict, excluding None values
    update_data = updates.dict(exclude_unset=True)
    
    updated_record = crud.update_production(entry_id, update_data)
    if not updated_record:
        raise HTTPException(status_code=404, detail="Entry not found")
    return updated_record