from fastapi import APIRouter, Depends, Query
from datetime import date
from .crud import crud
from .auth import org_admin_required, get_current_org
from .schemas import ProductionCreate

router = APIRouter()

# --------------------------------------------------
# ADD PRODUCTION ENTRY (org-scoped)
# --------------------------------------------------
@router.post("/production/")
def add_production(
    entry: ProductionCreate,
    ctx=Depends(org_admin_required)
):
    """
    Adds a new production record for a worker.
    Converts Pydantic model to dict for Firestore.
    Requires Admin or Owner role.
    """
    return crud.add_production(ctx["org_id"], entry.dict())


# --------------------------------------------------
# SALARY CALCULATION (org-scoped)
# --------------------------------------------------
@router.get("/salary/calculate")
def calculate_salary(
    worker_id: str, 
    start_date: date = Query(..., description="Format: YYYY-MM-DD"),
    end_date: date = Query(..., description="Format: YYYY-MM-DD"),
    ctx=Depends(get_current_org)
):
    """
    Calculates total meters and salary for a specific date range.
    Output structure is unchanged for frontend compatibility.
    """
    return crud.calculate_salary(
        org_id=ctx["org_id"],
        worker_id=worker_id, 
        start=str(start_date), 
        end=str(end_date)
    )