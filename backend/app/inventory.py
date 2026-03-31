"""
Inventory & Raw Materials router.

Firestore structure:
    organizations/{orgId}/
        suppliers/{supplierId}
            name, contact, phone, gst_number, payment_terms
        inventory/{itemId}
            name, category (yarn/thread/other), unit, current_stock, 
            min_stock_threshold, rate_per_unit, supplier_id
        stock_transactions/{txnId}
            item_id, type (in/out), quantity, rate, date, 
            reference (PO number / loom_id), notes, created_by
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List

from .auth import get_current_org, org_admin_required
manager_required = org_admin_required  # alias
from .database import db

router = APIRouter()

INVENTORY_CATEGORIES = ["Yarn", "Thread", "Dye", "Chemical", "Spare Parts", "Other"]


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------

class SupplierCreate(BaseModel):
    name: str
    contact: str = ""
    phone: str = ""
    gst_number: str = ""
    payment_terms: str = ""


class InventoryItemCreate(BaseModel):
    name: str
    category: str = "Yarn"
    unit: str = "kg"  # kg, meters, pieces, liters
    current_stock: float = 0
    min_stock_threshold: float = 10
    rate_per_unit: float = 0
    supplier_id: str = ""


class StockTransaction(BaseModel):
    item_id: str
    type: str = Field(..., pattern="^(in|out)$")
    quantity: float = Field(..., gt=0)
    rate: float = 0
    date: str  # YYYY-MM-DD
    reference: str = ""  # PO number, loom_id, etc.
    notes: str = ""


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def _col(org_id: str, name: str):
    return db.collection("organizations").document(org_id).collection(name)


# --------------------------------------------------
# SUPPLIERS
# --------------------------------------------------

@router.post("/suppliers/", tags=["Inventory"])
def create_supplier(supplier: SupplierCreate, ctx=Depends(org_admin_required)):
    """Creates a supplier. Requires Admin+."""
    data = {**supplier.dict(), "created_at": datetime.utcnow().isoformat()}
    doc_ref = _col(ctx["org_id"], "suppliers").document()
    doc_ref.set(data)
    return {"id": doc_ref.id, **data}


@router.get("/suppliers/", tags=["Inventory"])
def list_suppliers(ctx=Depends(get_current_org)):
    """Lists all suppliers."""
    docs = _col(ctx["org_id"], "suppliers").stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.put("/suppliers/{supplier_id}", tags=["Inventory"])
def update_supplier(supplier_id: str, supplier: SupplierCreate, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "suppliers").document(supplier_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Supplier not found")
    doc_ref.update(supplier.dict())
    return {"id": supplier_id, **doc_ref.get().to_dict()}


@router.delete("/suppliers/{supplier_id}", tags=["Inventory"])
def delete_supplier(supplier_id: str, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "suppliers").document(supplier_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Supplier not found")
    doc_ref.delete()
    return {"status": "deleted"}


# --------------------------------------------------
# INVENTORY ITEMS
# --------------------------------------------------

@router.get("/inventory/categories", tags=["Inventory"])
def list_categories():
    return INVENTORY_CATEGORIES


@router.post("/inventory/", tags=["Inventory"])
def create_item(item: InventoryItemCreate, ctx=Depends(org_admin_required)):
    """Creates an inventory item."""
    data = {**item.dict(), "created_at": datetime.utcnow().isoformat()}
    doc_ref = _col(ctx["org_id"], "inventory").document()
    doc_ref.set(data)
    return {"id": doc_ref.id, **data}


@router.get("/inventory/", tags=["Inventory"])
def list_items(
    category: Optional[str] = None,
    low_stock_only: bool = False,
    ctx=Depends(get_current_org),
):
    """Lists inventory items. Set low_stock_only=true to see items below threshold."""
    query = _col(ctx["org_id"], "inventory")
    if category:
        query = query.where("category", "==", category)
    
    items = [{"id": doc.id, **doc.to_dict()} for doc in query.stream()]
    
    if low_stock_only:
        items = [i for i in items if i.get("current_stock", 0) <= i.get("min_stock_threshold", 0)]
    
    # Add low_stock flag
    for item in items:
        item["is_low_stock"] = item.get("current_stock", 0) <= item.get("min_stock_threshold", 0)
    
    return items


@router.put("/inventory/{item_id}", tags=["Inventory"])
def update_item(item_id: str, item: InventoryItemCreate, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "inventory").document(item_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Item not found")
    doc_ref.update(item.dict())
    return {"id": item_id, **doc_ref.get().to_dict()}


@router.delete("/inventory/{item_id}", tags=["Inventory"])
def delete_item(item_id: str, ctx=Depends(org_admin_required)):
    doc_ref = _col(ctx["org_id"], "inventory").document(item_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Item not found")
    doc_ref.delete()
    return {"status": "deleted"}


# --------------------------------------------------
# STOCK TRANSACTIONS (in/out)
# --------------------------------------------------

@router.post("/inventory/transaction", tags=["Inventory"])
def record_transaction(txn: StockTransaction, ctx=Depends(manager_required)):
    """Records a stock in or stock out transaction. Updates item's current_stock atomically."""
    from google.cloud import firestore as fs_client
    
    org_id = ctx["org_id"]
    item_ref = _col(org_id, "inventory").document(txn.item_id)
    txn_ref = _col(org_id, "stock_transactions").document()
    
    @fs_client.transactional
    def _update_in_transaction(transaction):
        item_doc = item_ref.get(transaction=transaction)
        if not item_doc.exists:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        
        item_data = item_doc.to_dict()
        current_stock = item_data.get("current_stock", 0)
        
        # Calculate new stock
        if txn.type == "in":
            new_stock = current_stock + txn.quantity
        else:  # out
            if txn.quantity > current_stock:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock. Available: {current_stock}, Requested: {txn.quantity}"
                )
            new_stock = current_stock - txn.quantity
        
        # Record transaction and update stock atomically
        txn_data = {
            **txn.dict(),
            "previous_stock": current_stock,
            "new_stock": new_stock,
            "created_by": ctx["uid"],
            "created_at": datetime.utcnow().isoformat(),
        }
        transaction.set(txn_ref, txn_data)
        transaction.update(item_ref, {"current_stock": new_stock})
        
        return {"id": txn_ref.id, **txn_data}
    
    transaction = db.transaction()
    return _update_in_transaction(transaction)


@router.get("/inventory/transactions", tags=["Inventory"])
def list_transactions(
    item_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """Lists stock transactions with optional filters."""
    query = _col(ctx["org_id"], "stock_transactions")
    if item_id:
        query = query.where("item_id", "==", item_id)
    if start_date:
        query = query.where("date", ">=", start_date)
    if end_date:
        query = query.where("date", "<=", end_date)
    
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/inventory/alerts", tags=["Inventory"])
def get_low_stock_alerts(ctx=Depends(get_current_org)):
    """Returns items that are at or below their minimum stock threshold."""
    items = list_items(low_stock_only=True, ctx=ctx)
    return {
        "count": len(items),
        "items": items,
    }
