from pydantic import BaseModel
from datetime import date
from typing import Optional, List

# Admin Auth
class AdminAuth(BaseModel):
    email: str
    password: str

# Worker
class WorkerCreate(BaseModel):
    name: str
    phone: Optional[str] = None

# Shed & Loom
class ShedCreate(BaseModel):
    name: str

class LoomCreate(BaseModel):
    shed_id: int
    loom_number: str

# Production
class ProductionCreate(BaseModel):
    worker_id: int
    loom_id: int
    date: date
    shift: str  # "Day" or "Night"
    meters_produced: float
    rate_per_meter: float

# Salary Response
class SalarySummary(BaseModel):
    worker_id: int
    total_meters: float
    total_salary: float
    period: str