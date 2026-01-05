from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Updated Imports: Including get_current_user for role management
from .database import db 
from .auth import admin_required, get_current_user 
from .crud import crud
from .schemas import WorkerCreate
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
    role = "Admin" if (is_admin_claim or email == "yugendharanmohan@gmail.com") else "User"
    
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