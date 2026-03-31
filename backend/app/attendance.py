"""
Attendance & Leave Management router.

Firestore structure:
    organizations/{orgId}/
        attendance/{attendanceId}    — daily attendance records
            worker_id, date, status (Present/Absent/Half-Day), marked_by, marked_at
        leave_requests/{requestId}   — leave requests
            worker_id, start_date, end_date, reason, status (pending/approved/rejected), reviewed_by
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List

from .auth import get_current_org, org_admin_required as manager_required
from .crud import crud
from .database import db

router = APIRouter()


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------

class AttendanceMark(BaseModel):
    worker_id: str
    date: str  # YYYY-MM-DD
    status: str = Field(..., pattern="^(Present|Absent|Half-Day)$")


class BulkAttendanceMark(BaseModel):
    date: str  # YYYY-MM-DD
    entries: List[AttendanceMark]


class LeaveRequestCreate(BaseModel):
    worker_id: str
    start_date: str
    end_date: str
    reason: str = ""


class LeaveReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    reviewer_note: str = ""


# --------------------------------------------------
# ATTENDANCE CRUD (added to CRUD class dynamically)
# --------------------------------------------------

def _mark_attendance(org_id: str, worker_id: str, date: str, status: str, marked_by: str):
    """Marks or updates attendance for a worker on a date."""
    col = db.collection("organizations").document(org_id).collection("attendance")
    
    # Check if attendance already exists for this worker+date
    existing = list(col.where("worker_id", "==", worker_id)
                       .where("date", "==", date).stream())
    
    data = {
        "worker_id": worker_id,
        "date": date,
        "status": status,
        "marked_by": marked_by,
        "marked_at": datetime.utcnow().isoformat(),
    }
    
    if existing:
        # Update existing record
        existing[0].reference.update(data)
        return {"id": existing[0].id, **data}
    else:
        doc_ref = col.document()
        doc_ref.set(data)
        return {"id": doc_ref.id, **data}


def _get_attendance(org_id: str, date: str = None, worker_id: str = None,
                     start_date: str = None, end_date: str = None):
    """Returns attendance records with optional filters."""
    col = db.collection("organizations").document(org_id).collection("attendance")
    query = col
    
    if date:
        query = query.where("date", "==", date)
    if worker_id:
        query = query.where("worker_id", "==", worker_id)
    if start_date and not date:
        query = query.where("date", ">=", start_date)
    if end_date and not date:
        query = query.where("date", "<=", end_date)
    
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


def _get_attendance_summary(org_id: str, worker_id: str, start_date: str, end_date: str):
    """Returns attendance summary for a worker in a date range."""
    records = _get_attendance(org_id, worker_id=worker_id,
                               start_date=start_date, end_date=end_date)
    
    present = sum(1 for r in records if r["status"] == "Present")
    absent = sum(1 for r in records if r["status"] == "Absent")
    half_day = sum(1 for r in records if r["status"] == "Half-Day")
    
    return {
        "worker_id": worker_id,
        "start_date": start_date,
        "end_date": end_date,
        "total_records": len(records),
        "present": present,
        "absent": absent,
        "half_day": half_day,
        "effective_days": present + (half_day * 0.5),
        "records": records,
    }


# --------------------------------------------------
# LEAVE REQUEST CRUD
# --------------------------------------------------

def _create_leave_request(org_id: str, data: dict, requested_by: str):
    """Creates a leave request."""
    col = db.collection("organizations").document(org_id).collection("leave_requests")
    
    leave_data = {
        **data,
        "status": "pending",
        "requested_by": requested_by,
        "created_at": datetime.utcnow().isoformat(),
        "reviewed_by": None,
        "reviewed_at": None,
        "reviewer_note": "",
    }
    doc_ref = col.document()
    doc_ref.set(leave_data)
    return {"id": doc_ref.id, **leave_data}


def _get_leave_requests(org_id: str, worker_id: str = None, status: str = None):
    """Returns leave requests with optional filters."""
    col = db.collection("organizations").document(org_id).collection("leave_requests")
    query = col
    
    if worker_id:
        query = query.where("worker_id", "==", worker_id)
    if status:
        query = query.where("status", "==", status)
    
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


def _review_leave_request(org_id: str, request_id: str, new_status: str,
                           reviewer_uid: str, reviewer_note: str = ""):
    """Approves or rejects a leave request."""
    doc_ref = db.collection("organizations").document(org_id) \
               .collection("leave_requests").document(request_id)
    doc = doc_ref.get()
    if not doc.exists:
        return None
    
    doc_ref.update({
        "status": new_status,
        "reviewed_by": reviewer_uid,
        "reviewed_at": datetime.utcnow().isoformat(),
        "reviewer_note": reviewer_note,
    })
    
    return {"id": request_id, **doc_ref.get().to_dict()}


# --------------------------------------------------
# ENDPOINTS: Attendance
# --------------------------------------------------

@router.post("/attendance/mark", tags=["Attendance"])
def mark_attendance(entry: AttendanceMark, ctx=Depends(manager_required)):
    """Marks attendance for a single worker. Requires Manager+."""
    result = _mark_attendance(
        ctx["org_id"], entry.worker_id, entry.date, entry.status, ctx["uid"]
    )
    return result


@router.post("/attendance/bulk", tags=["Attendance"])
def bulk_mark_attendance(bulk: BulkAttendanceMark, ctx=Depends(manager_required)):
    """Marks attendance for multiple workers at once."""
    results = []
    for entry in bulk.entries:
        r = _mark_attendance(
            ctx["org_id"], entry.worker_id, bulk.date, entry.status, ctx["uid"]
        )
        results.append(r)
    return {"count": len(results), "records": results}


@router.get("/attendance/", tags=["Attendance"])
def get_attendance(
    date: Optional[str] = None,
    worker_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ctx=Depends(manager_required),
):
    """Returns attendance records. Filter by date, worker, or date range."""
    return _get_attendance(ctx["org_id"], date=date, worker_id=worker_id,
                           start_date=start_date, end_date=end_date)


@router.get("/attendance/summary/{worker_id}", tags=["Attendance"])
def get_worker_attendance_summary(
    worker_id: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(manager_required),
):
    """Returns attendance summary with present/absent/half-day counts."""
    return _get_attendance_summary(ctx["org_id"], worker_id, start_date, end_date)


@router.get("/attendance/daily/{date}", tags=["Attendance"])
def get_daily_report(date: str, ctx=Depends(manager_required)):
    """Returns daily attendance: all workers with their status for a given date."""
    org_id = ctx["org_id"]
    
    # Get all workers
    workers = crud.get_workers(org_id)
    
    # Get attendance for the date
    attendance = _get_attendance(org_id, date=date)
    att_by_worker = {a["worker_id"]: a for a in attendance}
    
    # Merge: each worker gets their attendance status (or "Not Marked")
    report = []
    for w in workers:
        att = att_by_worker.get(w["id"])
        report.append({
            "worker_id": w["id"],
            "worker_name": w.get("name", ""),
            "status": att["status"] if att else "Not Marked",
            "marked_at": att.get("marked_at") if att else None,
        })
    
    present = sum(1 for r in report if r["status"] == "Present")
    absent = sum(1 for r in report if r["status"] == "Absent")
    half_day = sum(1 for r in report if r["status"] == "Half-Day")
    not_marked = sum(1 for r in report if r["status"] == "Not Marked")
    
    return {
        "date": date,
        "total_workers": len(workers),
        "present": present,
        "absent": absent,
        "half_day": half_day,
        "not_marked": not_marked,
        "workers": report,
    }


# --------------------------------------------------
# ENDPOINTS: Leave Requests
# --------------------------------------------------

@router.post("/leave/request", tags=["Leave"])
def create_leave_request(req: LeaveRequestCreate, ctx=Depends(get_current_org)):
    """Creates a leave request for a worker."""
    return _create_leave_request(ctx["org_id"], req.dict(), ctx["uid"])


@router.get("/leave/requests", tags=["Leave"])
def list_leave_requests(
    worker_id: Optional[str] = None,
    status: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """Lists leave requests. Filter by worker_id or status."""
    return _get_leave_requests(ctx["org_id"], worker_id=worker_id, status=status)


@router.put("/leave/requests/{request_id}", tags=["Leave"])
def review_leave_request(
    request_id: str,
    review: LeaveReview,
    ctx=Depends(manager_required),
):
    """Approves or rejects a leave request. Requires Manager+."""
    result = _review_leave_request(
        ctx["org_id"], request_id, review.status, ctx["uid"], review.reviewer_note
    )
    if not result:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return result
