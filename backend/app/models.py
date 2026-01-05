from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, datetime

# --------------------------------------------------
# BASE CONFIGURATION
# --------------------------------------------------
# We use Pydantic BaseModel to define the "Shape" of your Firestore Documents.

class FirestoreModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# --------------------------------------------------
# WORKER MODEL
# --------------------------------------------------
class WorkerModel(FirestoreModel):
    id: Optional[str] = None  # Firestore auto-generated ID
    name: str
    phone: Optional[str] = None
    is_active: bool = True

# --------------------------------------------------
# SHED MODEL
# --------------------------------------------------
class ShedModel(FirestoreModel):
    id: Optional[str] = None
    name: str  # e.g., "A", "B"

# --------------------------------------------------
# LOOM MODEL
# --------------------------------------------------
class LoomModel(FirestoreModel):
    id: Optional[str] = None
    loom_number: str  # e.g., "1", "2"
    shed_id: str      # Reference to the Shed Document ID

# --------------------------------------------------
# PRODUCTION RECORD MODEL
# --------------------------------------------------
class ProductionRecordModel(FirestoreModel):
    id: Optional[str] = None
    
    date: str  # Stored as "YYYY-MM-DD" for easy Firestore querying
    shift: str # "Day" or "Night"
    
    meters: float
    rate: float
    total_amount: float # Calculated as meters * rate

    worker_id: str  # Reference to Worker Document ID
    loom_id: str    # Reference to Loom Document ID
    
    # Optional fields for denormalization (helps with fast UI rendering)
    worker_name: Optional[str] = None
    loom_label: Optional[str] = None # e.g., "A1"

# --------------------------------------------------
# ADMIN MODEL (Firebase Auth metadata)
# --------------------------------------------------
class AdminModel(FirestoreModel):
    uid: str
    email: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)