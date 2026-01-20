from pydantic import BaseModel, Field
from datetime import date
from typing import Optional, List

# --------------------------------------------------
# WORKER
# --------------------------------------------------
class WorkerCreate(BaseModel):
    name: str
    phone: Optional[str] = None


# --------------------------------------------------
# SHED & LOOM
# --------------------------------------------------
class ShedCreate(BaseModel):
    name: str


class LoomCreate(BaseModel):
    # CHANGE: shed_id is now a string to match Firestore document IDs
    shed_id: str 
    loom_number: str


# --------------------------------------------------
# PRODUCTION ENTRY
# --------------------------------------------------
class ProductionCreate(BaseModel):
    # CHANGE: IDs are now strings for Firestore compatibility
    worker_id: str
    loom_id: str
    
    # Denormalization: Including these helps generate the Salary Slip 
    # without extra database lookups in NoSQL
    shed_name: str 
    loom_number: str
    
    date: date # Pydantic will validate this and we convert to str in crud.py
    
    # Strict validation remains unchanged
    shift: str = Field(..., pattern="^(Day|Night)$") 
    meters: float = Field(..., gt=0)
    rate: float = Field(..., gt=0)


# --------------------------------------------------
# SALARY SUMMARY (Used for API documentation)
# --------------------------------------------------
class SalarySummary(BaseModel):
    total_meters: float
    total_salary: float

# NEW: For Updating Workers
class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

# NEW: For Analytics Response
class AnalyticsSummary(BaseModel):
    total_production: float
    total_salary: float
    active_workers: int
    top_worker: Optional[str] = None

# NEW: Edit Meter Entry
class ProductionUpdate(BaseModel):
    meters: Optional[float] = None
    shift: Optional[str] = None