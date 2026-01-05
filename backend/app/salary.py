from fastapi import APIRouter, Depends, Query
from datetime import date
from .crud import crud # Ensure relative import if in the same package
from .auth import admin_required, get_current_user
from .schemas import ProductionCreate # Keep for request validation

# We define the router here to be included in main.py
router = APIRouter()

# --------------------------------------------------
# ADD PRODUCTION ENTRY
# --------------------------------------------------
@router.post("/production/")
def add_production(
    entry: ProductionCreate,
    # REMOVED: db=Depends(get_db)
    admin=Depends(admin_required) # Keep security check
):
    """
    Adds a new production record for a worker.
    Converts Pydantic model to dict for Firestore.
    """
    return crud.add_production(entry.dict())


# --------------------------------------------------
# SALARY CALCULATION
# --------------------------------------------------
@router.get("/salary/calculate")
def calculate_salary(
    # Firestore IDs are strings (e.g., "zX9yW2...")
    worker_id: str, 
    start_date: date = Query(..., description="Format: YYYY-MM-DD"),
    end_date: date = Query(..., description="Format: YYYY-MM-DD"),
    # REMOVED: db=Depends(get_db)
    admin=Depends(get_current_user)
):
    """
    Calculates total meters and salary for a specific date range.
    Output structure is UNCHANGED for frontend compatibility.
    """
    # Convert date objects to strings as Firestore queries work best with ISO strings
    return crud.calculate_salary(
        worker_id=worker_id, 
        start=str(start_date), 
        end=str(end_date)
    )