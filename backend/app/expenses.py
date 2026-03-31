"""
Expense Tracking router.

Firestore structure:
    organizations/{orgId}/
        expenses/{expenseId}
            category, amount, description, date, receipt_url, status,
            submitted_by, approved_by, created_at
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List

from .auth import get_current_org, org_admin_required as manager_required
from .database import db

router = APIRouter()

# Categories
EXPENSE_CATEGORIES = [
    "Electricity", "Maintenance", "Transport", "Raw Materials",
    "Equipment", "Rent", "Wages (Misc)", "Other"
]


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------

class ExpenseCreate(BaseModel):
    category: str
    amount: float = Field(..., gt=0)
    description: str = ""
    date: str  # YYYY-MM-DD
    receipt_url: str = ""


class ExpenseApproval(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    note: str = ""


# --------------------------------------------------
# CRUD
# --------------------------------------------------

def _col(org_id: str):
    return db.collection("organizations").document(org_id).collection("expenses")


@router.get("/expenses/categories", tags=["Expenses"])
def list_categories():
    """Returns available expense categories."""
    return EXPENSE_CATEGORIES


@router.post("/expenses/", tags=["Expenses"])
def create_expense(expense: ExpenseCreate, ctx=Depends(get_current_org)):
    """Creates an expense entry (status: pending)."""
    data = {
        **expense.dict(),
        "status": "pending",
        "submitted_by": ctx["uid"],
        "submitted_email": ctx.get("email", ""),
        "approved_by": None,
        "approved_at": None,
        "approval_note": "",
        "created_at": datetime.utcnow().isoformat(),
    }
    doc_ref = _col(ctx["org_id"]).document()
    doc_ref.set(data)
    return {"id": doc_ref.id, **data}


@router.get("/expenses/", tags=["Expenses"])
def list_expenses(
    status: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """Lists expenses with optional filters."""
    query = _col(ctx["org_id"])
    
    if status:
        query = query.where("status", "==", status)
    if category:
        query = query.where("category", "==", category)
    if start_date:
        query = query.where("date", ">=", start_date)
    if end_date:
        query = query.where("date", "<=", end_date)
    
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.put("/expenses/{expense_id}/approve", tags=["Expenses"])
def approve_expense(
    expense_id: str,
    approval: ExpenseApproval,
    ctx=Depends(manager_required),
):
    """Approves or rejects an expense. Requires Manager+."""
    doc_ref = _col(ctx["org_id"]).document(expense_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    doc_ref.update({
        "status": approval.status,
        "approved_by": ctx["uid"],
        "approved_at": datetime.utcnow().isoformat(),
        "approval_note": approval.note,
    })
    return {"id": expense_id, **doc_ref.get().to_dict()}


@router.delete("/expenses/{expense_id}", tags=["Expenses"])
def delete_expense(expense_id: str, ctx=Depends(manager_required)):
    """Deletes an expense. Requires Manager+."""
    doc_ref = _col(ctx["org_id"]).document(expense_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Expense not found")
    doc_ref.delete()
    return {"status": "deleted"}


@router.get("/expenses/summary", tags=["Expenses"])
def expense_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Returns expense summary grouped by category for a date range."""
    query = _col(ctx["org_id"]) \
        .where("date", ">=", start_date) \
        .where("date", "<=", end_date) \
        .where("status", "==", "approved")
    
    docs = list(query.stream())
    
    by_category = {}
    total = 0
    for doc in docs:
        d = doc.to_dict()
        cat = d.get("category", "Other")
        amt = d.get("amount", 0)
        by_category[cat] = by_category.get(cat, 0) + amt
        total += amt
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total": total,
        "by_category": by_category,
        "count": len(docs),
    }
