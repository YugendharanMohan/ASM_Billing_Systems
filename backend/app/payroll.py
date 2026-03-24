"""
Advanced Payroll router.

Provides:
- Salary components (bonus, deduction, allowance) per worker
- Advance management (issue, repay, track balance)
- Payroll run (batch salary calculation for a period)
- Payslip generation (detailed breakdown per worker)
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from .auth import get_current_org, org_admin_required
manager_required = org_admin_required  # alias
from .crud import crud
from .database import db


router = APIRouter()


def _col(org_id: str, name: str):
    return db.collection("organizations").document(org_id).collection(name)


# ==================================================
# SCHEMAS
# ==================================================

class SalaryComponentCreate(BaseModel):
    worker_id: str
    type: str  # "bonus" | "deduction" | "allowance"
    name: str  # e.g. "Festival Bonus", "PF Deduction", "Travel Allowance"
    amount: float
    recurring: bool = False  # If true, auto-applied every payroll run
    notes: str = ""


class AdvanceCreate(BaseModel):
    worker_id: str
    amount: float
    reason: str = ""


class AdvanceRepayment(BaseModel):
    amount: float
    notes: str = ""


class PayrollRunCreate(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str
    notes: str = ""


# ==================================================
# SALARY COMPONENTS
# ==================================================

@router.post("/payroll/components", tags=["Payroll"])
def add_salary_component(data: SalaryComponentCreate, ctx=Depends(org_admin_required)):
    """Add a bonus, deduction, or allowance for a worker."""
    org_id = ctx["org_id"]

    if data.type not in ("bonus", "deduction", "allowance"):
        raise HTTPException(400, "Type must be 'bonus', 'deduction', or 'allowance'")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    doc_data = {
        **data.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": ctx.get("email", ""),
        "active": True,
    }
    ref = _col(org_id, "salary_components").document()
    ref.set(doc_data)
    return {"id": ref.id, **doc_data}


@router.get("/payroll/components", tags=["Payroll"])
def list_salary_components(
    worker_id: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """List salary components, optionally filtered by worker."""
    org_id = ctx["org_id"]
    query = _col(org_id, "salary_components")
    if worker_id:
        query = query.where("worker_id", "==", worker_id)
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.delete("/payroll/components/{component_id}", tags=["Payroll"])
def delete_salary_component(component_id: str, ctx=Depends(org_admin_required)):
    """Delete (deactivate) a salary component."""
    ref = _col(ctx["org_id"], "salary_components").document(component_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Component not found")
    ref.update({"active": False})
    return {"status": "deactivated", "id": component_id}


# ==================================================
# ADVANCES
# ==================================================

@router.post("/payroll/advances", tags=["Payroll"])
def issue_advance(data: AdvanceCreate, ctx=Depends(manager_required)):
    """Issue a salary advance to a worker."""
    org_id = ctx["org_id"]
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    doc_data = {
        "worker_id": data.worker_id,
        "amount": data.amount,
        "reason": data.reason,
        "issued_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "issued_by": ctx.get("email", ""),
        "balance": data.amount,  # Outstanding balance
        "status": "active",  # active | repaid
        "repayments": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    ref = _col(org_id, "advances").document()
    ref.set(doc_data)
    return {"id": ref.id, **doc_data}


@router.get("/payroll/advances", tags=["Payroll"])
def list_advances(
    worker_id: Optional[str] = None,
    status: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """List advances, optionally filtered by worker or status."""
    org_id = ctx["org_id"]
    query = _col(org_id, "advances")
    if worker_id:
        query = query.where("worker_id", "==", worker_id)
    if status:
        query = query.where("status", "==", status)
    docs = query.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.post("/payroll/advances/{advance_id}/repay", tags=["Payroll"])
def repay_advance(advance_id: str, data: AdvanceRepayment, ctx=Depends(manager_required)):
    """Record a repayment against an advance."""
    ref = _col(ctx["org_id"], "advances").document(advance_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Advance not found")

    advance = doc.to_dict()
    if advance["status"] == "repaid":
        raise HTTPException(400, "Advance already fully repaid")
    if data.amount <= 0:
        raise HTTPException(400, "Repayment must be positive")
    if data.amount > advance["balance"]:
        raise HTTPException(400, f"Repayment exceeds balance of {advance['balance']}")

    new_balance = round(advance["balance"] - data.amount, 2)
    repayment_entry = {
        "amount": data.amount,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "notes": data.notes,
    }

    update = {
        "balance": new_balance,
        "repayments": advance.get("repayments", []) + [repayment_entry],
    }
    if new_balance == 0:
        update["status"] = "repaid"

    ref.update(update)
    return {"id": advance_id, "new_balance": new_balance, "status": update.get("status", "active")}


# ==================================================
# PAYROLL RUN
# ==================================================

@router.post("/payroll/run", tags=["Payroll"])
def execute_payroll_run(data: PayrollRunCreate, ctx=Depends(org_admin_required)):
    """
    Execute a payroll run for a date range.
    Calculates net salary for each worker:
      base (production) + allowances + bonuses - deductions - advance_repayment
    """
    org_id = ctx["org_id"]

    # 1. Get all workers
    workers = crud.get_workers(org_id)

    # 2. Get active salary components
    comp_docs = _col(org_id, "salary_components").where("active", "==", True).stream()
    components = [{"id": doc.id, **doc.to_dict()} for doc in comp_docs]

    # 3. Get active advances
    adv_docs = _col(org_id, "advances").where("status", "==", "active").stream()
    advances = [{"id": doc.id, **doc.to_dict()} for doc in adv_docs]

    payslips = []
    total_payout = 0

    for worker in workers:
        wid = worker["id"]
        wname = worker.get("name", wid)

        # Base salary from production
        salary_data = crud.calculate_salary(org_id, wid, data.start_date, data.end_date)
        base_salary = salary_data["summary"]["total_salary"]
        total_meters = salary_data["summary"]["total_meters"]

        # Salary components for this worker
        w_components = [c for c in components if c["worker_id"] == wid]
        bonuses = sum(c["amount"] for c in w_components if c["type"] == "bonus")
        allowances = sum(c["amount"] for c in w_components if c["type"] == "allowance")
        deductions = sum(c["amount"] for c in w_components if c["type"] == "deduction")

        # Advance deduction (auto-deduct from oldest advance)
        advance_deduction = 0
        w_advances = [a for a in advances if a["worker_id"] == wid]
        for adv in sorted(w_advances, key=lambda a: a.get("issued_date", "")):
            if adv["balance"] > 0:
                # Deduct up to 50% of base salary or remaining balance
                max_deduct = min(base_salary * 0.5, adv["balance"])
                if max_deduct > 0:
                    advance_deduction += max_deduct
                    # Update advance balance
                    new_bal = round(adv["balance"] - max_deduct, 2)
                    update = {"balance": new_bal}
                    if new_bal == 0:
                        update["status"] = "repaid"
                    _col(org_id, "advances").document(adv["id"]).update(update)
                    break  # One advance at a time

        gross = base_salary + bonuses + allowances
        net = gross - deductions - advance_deduction

        payslip = {
            "worker_id": wid,
            "worker_name": wname,
            "period_start": data.start_date,
            "period_end": data.end_date,
            "total_meters": round(total_meters, 2),
            "base_salary": round(base_salary, 2),
            "bonuses": round(bonuses, 2),
            "allowances": round(allowances, 2),
            "deductions": round(deductions, 2),
            "advance_deduction": round(advance_deduction, 2),
            "gross_salary": round(gross, 2),
            "net_salary": round(net, 2),
            "components": [
                {"name": c["name"], "type": c["type"], "amount": c["amount"]}
                for c in w_components
            ],
            "generated_at": datetime.utcnow().isoformat(),
        }

        # Only include workers with some activity
        if total_meters > 0 or base_salary > 0:
            payslips.append(payslip)
            total_payout += net

    # Save payroll run record
    run_data = {
        "period_start": data.start_date,
        "period_end": data.end_date,
        "notes": data.notes,
        "worker_count": len(payslips),
        "total_payout": round(total_payout, 2),
        "status": "completed",
        "generated_by": ctx.get("email", ""),
        "generated_at": datetime.utcnow().isoformat(),
    }
    run_ref = _col(org_id, "payroll_runs").document()
    run_ref.set(run_data)

    # Save individual payslips
    for ps in payslips:
        _col(org_id, "payslips").document().set({**ps, "payroll_run_id": run_ref.id})

    return {
        "payroll_run_id": run_ref.id,
        **run_data,
        "payslips": payslips,
    }


@router.get("/payroll/runs", tags=["Payroll"])
def list_payroll_runs(ctx=Depends(manager_required)):
    """List all past payroll runs."""
    docs = _col(ctx["org_id"], "payroll_runs").order_by("generated_at", direction="DESCENDING").stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/payroll/payslip/{worker_id}", tags=["Payroll"])
def get_worker_payslip(
    worker_id: str,
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Get a specific worker's payslip for a period (from saved payslips or generate on-the-fly)."""
    org_id = ctx["org_id"]

    # Try to find existing payslip
    docs = _col(org_id, "payslips") \
        .where("worker_id", "==", worker_id) \
        .where("period_start", "==", start_date) \
        .where("period_end", "==", end_date) \
        .limit(1) \
        .stream()

    for doc in docs:
        return {"id": doc.id, **doc.to_dict()}

    # Generate on-the-fly if no saved payslip
    salary_data = crud.calculate_salary(org_id, worker_id, start_date, end_date)

    # Get components
    comp_docs = _col(org_id, "salary_components") \
        .where("worker_id", "==", worker_id) \
        .where("active", "==", True) \
        .stream()
    components = [{"id": doc.id, **doc.to_dict()} for doc in comp_docs]

    bonuses = sum(c["amount"] for c in components if c["type"] == "bonus")
    allowances = sum(c["amount"] for c in components if c["type"] == "allowance")
    deductions = sum(c["amount"] for c in components if c["type"] == "deduction")

    base = salary_data["summary"]["total_salary"]
    gross = base + bonuses + allowances
    net = gross - deductions

    # Get worker name
    workers = crud.get_workers(org_id)
    worker_map = {w["id"]: w.get("name", w["id"]) for w in workers}

    return {
        "worker_id": worker_id,
        "worker_name": worker_map.get(worker_id, worker_id),
        "period_start": start_date,
        "period_end": end_date,
        "total_meters": salary_data["summary"]["total_meters"],
        "base_salary": round(base, 2),
        "bonuses": round(bonuses, 2),
        "allowances": round(allowances, 2),
        "deductions": round(deductions, 2),
        "advance_deduction": 0,
        "gross_salary": round(gross, 2),
        "net_salary": round(net, 2),
        "production_details": salary_data["details"],
        "components": [
            {"name": c["name"], "type": c["type"], "amount": c["amount"]}
            for c in components
        ],
    }
