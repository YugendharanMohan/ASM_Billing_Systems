"""
Order Management router.

Firestore structure:
    organizations/{orgId}/
        customers/{customerId}
            name, contact, phone, address, gst_number
        orders/{orderId}
            customer_id, fabric_type, ordered_meters, rate_per_meter,
            deadline, status (pending/in_progress/completed/delivered),
            produced_meters, delivery_date, notes, created_at
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from .auth import get_current_org, org_admin_required
manager_required = org_admin_required  # alias
from .database import db

router = APIRouter()


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------

class CustomerCreate(BaseModel):
    name: str
    contact: str = ""
    phone: str = ""
    address: str = ""
    gst_number: str = ""


class OrderCreate(BaseModel):
    customer_id: str
    fabric_type: str
    ordered_meters: float = Field(..., gt=0)
    rate_per_meter: float = Field(..., gt=0)
    deadline: str = ""
    notes: str = ""


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    produced_meters: Optional[float] = None
    delivery_date: Optional[str] = None
    notes: Optional[str] = None


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def _col(org_id: str, name: str):
    return db.collection("organizations").document(org_id).collection(name)


# --------------------------------------------------
# CUSTOMERS
# --------------------------------------------------

@router.post("/customers/", tags=["Orders"])
def create_customer(customer: CustomerCreate, ctx=Depends(org_admin_required)):
    data = {**customer.dict(), "created_at": datetime.utcnow().isoformat()}
    doc_ref = _col(ctx["org_id"], "customers").document()
    doc_ref.set(data)
    return {"id": doc_ref.id, **data}


@router.get("/customers/", tags=["Orders"])
def list_customers(ctx=Depends(get_current_org)):
    docs = _col(ctx["org_id"], "customers").stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.put("/customers/{customer_id}", tags=["Orders"])
def update_customer(customer_id: str, customer: CustomerCreate, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "customers").document(customer_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    doc_ref.update(customer.dict())
    return {"id": customer_id, **doc_ref.get().to_dict()}


@router.delete("/customers/{customer_id}", tags=["Orders"])
def delete_customer(customer_id: str, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "customers").document(customer_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    doc_ref.delete()
    return {"status": "deleted"}


# --------------------------------------------------
# ORDERS
# --------------------------------------------------

@router.post("/orders/", tags=["Orders"])
def create_order(order: OrderCreate, ctx=Depends(manager_required)):
    """Creates a new work order."""
    # Verify customer exists
    cust_ref = _col(ctx["org_id"], "customers").document(order.customer_id)
    if not cust_ref.get().exists:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    data = {
        **order.dict(),
        "status": "pending",
        "produced_meters": 0,
        "completion_pct": 0,
        "total_value": order.ordered_meters * order.rate_per_meter,
        "delivery_date": None,
        "created_by": ctx["uid"],
        "created_at": datetime.utcnow().isoformat(),
    }
    doc_ref = _col(ctx["org_id"], "orders").document()
    doc_ref.set(data)
    return {"id": doc_ref.id, **data}


@router.get("/orders/", tags=["Orders"])
def list_orders(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """Lists orders with optional filters."""
    query = _col(ctx["org_id"], "orders")
    if status:
        query = query.where("status", "==", status)
    if customer_id:
        query = query.where("customer_id", "==", customer_id)
    
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/orders/{order_id}", tags=["Orders"])
def get_order(order_id: str, ctx=Depends(get_current_org)):
    doc_ref = _col(ctx["org_id"], "orders").document(order_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"id": doc.id, **doc.to_dict()}


@router.put("/orders/{order_id}", tags=["Orders"])
def update_order(order_id: str, updates: OrderUpdate, ctx=Depends(manager_required)):
    """Updates an order's status, produced meters, etc."""
    doc_ref = _col(ctx["org_id"], "orders").document(order_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_data = doc.to_dict()
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Recalculate completion percentage
    if "produced_meters" in update_dict:
        ordered = order_data.get("ordered_meters", 1)
        produced = update_dict["produced_meters"]
        update_dict["completion_pct"] = round(min(produced / ordered * 100, 100), 1)
    
    update_dict["updated_at"] = datetime.utcnow().isoformat()
    doc_ref.update(update_dict)
    return {"id": order_id, **doc_ref.get().to_dict()}


@router.delete("/orders/{order_id}", tags=["Orders"])
def delete_order(order_id: str, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "orders").document(order_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Order not found")
    doc_ref.delete()
    return {"status": "deleted"}


@router.get("/orders/summary/stats", tags=["Orders"])
def order_stats(ctx=Depends(get_current_org)):
    """Returns order summary stats."""
    docs = list(_col(ctx["org_id"], "orders").stream())
    
    total = len(docs)
    by_status = {}
    total_value = 0
    total_produced = 0
    total_ordered = 0
    
    for doc in docs:
        d = doc.to_dict()
        status = d.get("status", "pending")
        by_status[status] = by_status.get(status, 0) + 1
        total_value += d.get("total_value", 0)
        total_produced += d.get("produced_meters", 0)
        total_ordered += d.get("ordered_meters", 0)
    
    return {
        "total_orders": total,
        "by_status": by_status,
        "total_value": total_value,
        "total_ordered_meters": total_ordered,
        "total_produced_meters": total_produced,
        "overall_completion_pct": round(
            (total_produced / total_ordered * 100) if total_ordered > 0 else 0, 1
        ),
    }
