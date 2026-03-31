"""
Reporting & Analytics router.

Provides:
- Loom efficiency metrics (meters/hour, utilization %)
- Worker performance scoring
- Comparative analytics (this month vs last, this year vs last)
- P&L summary (order revenue - expenses - salaries)
- CSV export for any data table
"""

import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional

from .auth import get_current_org
from .audit import get_audit_log
from .crud import crud
from .database import db

router = APIRouter()


# --------------------------------------------------
# AUDIT LOG
# --------------------------------------------------

@router.get("/analytics/audit-log", tags=["Analytics"])
def fetch_audit_log(
    limit: int = Query(50, ge=1, le=100),
    ctx=Depends(get_current_org),
):
    """Returns recent audit log entries for this organization."""
    return get_audit_log(ctx["org_id"], limit=limit)


def _col(org_id: str, name: str):
    return db.collection("organizations").document(org_id).collection(name)


def _get_records(org_id: str, collection: str, start: str, end: str):
    """Fetches records from a date-ranged collection."""
    docs = _col(org_id, collection) \
        .where("date", ">=", start) \
        .where("date", "<=", end) \
        .stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


# --------------------------------------------------
# LOOM EFFICIENCY
# --------------------------------------------------

@router.get("/analytics/loom-efficiency", tags=["Analytics"])
def loom_efficiency(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Returns loom-wise efficiency: meters produced, entries count, avg meters/entry."""
    records = _get_records(ctx["org_id"], "production", start_date, end_date)
    
    loom_stats = {}
    for r in records:
        loom_id = r.get("loom_id", "unknown")
        loom_label = f"{r.get('shed_name', '')}-{r.get('loom_number', '')}"
        
        if loom_id not in loom_stats:
            loom_stats[loom_id] = {
                "loom_id": loom_id,
                "loom_label": loom_label,
                "total_meters": 0,
                "total_entries": 0,
                "shifts": set(),
                "workers_used": set(),
            }
        
        stats = loom_stats[loom_id]
        stats["total_meters"] += r.get("meters", 0)
        stats["total_entries"] += 1
        stats["shifts"].add(r.get("shift", "Day"))
        stats["workers_used"].add(r.get("worker_id", ""))
    
    # Convert sets to counts for JSON
    results = []
    for loom_id, stats in loom_stats.items():
        avg_per_entry = stats["total_meters"] / stats["total_entries"] if stats["total_entries"] > 0 else 0
        results.append({
            "loom_id": stats["loom_id"],
            "loom_label": stats["loom_label"],
            "total_meters": round(stats["total_meters"], 2),
            "total_entries": stats["total_entries"],
            "avg_meters_per_entry": round(avg_per_entry, 2),
            "unique_workers": len(stats["workers_used"]),
            "shifts_worked": len(stats["shifts"]),
        })
    
    results.sort(key=lambda x: x["total_meters"], reverse=True)
    return results


# --------------------------------------------------
# WORKER PERFORMANCE
# --------------------------------------------------

@router.get("/analytics/worker-performance", tags=["Analytics"])
def worker_performance(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Returns worker performance scores based on production + attendance."""
    org_id = ctx["org_id"]
    
    # Get production
    prod_records = _get_records(org_id, "production", start_date, end_date)
    
    # Get attendance
    att_records = _get_records(org_id, "attendance", start_date, end_date)
    
    # Get workers
    workers = crud.get_workers(org_id)
    worker_map = {w["id"]: w.get("name", w["id"]) for w in workers}
    
    # Aggregate production per worker
    worker_prod = {}
    for r in prod_records:
        wid = r.get("worker_id", "")
        if wid not in worker_prod:
            worker_prod[wid] = {"meters": 0, "entries": 0, "salary": 0}
        worker_prod[wid]["meters"] += r.get("meters", 0)
        worker_prod[wid]["entries"] += 1
        worker_prod[wid]["salary"] += r.get("total_amount", 0)
    
    # Aggregate attendance per worker
    worker_att = {}
    for r in att_records:
        wid = r.get("worker_id", "")
        status = r.get("status", "")
        if wid not in worker_att:
            worker_att[wid] = {"present": 0, "absent": 0, "half_day": 0}
        if status == "Present":
            worker_att[wid]["present"] += 1
        elif status == "Absent":
            worker_att[wid]["absent"] += 1
        elif status == "Half-Day":
            worker_att[wid]["half_day"] += 1
    
    # Calculate scores
    max_meters = max((p["meters"] for p in worker_prod.values()), default=1)
    
    results = []
    for wid in set(list(worker_prod.keys()) + list(worker_att.keys())):
        prod = worker_prod.get(wid, {"meters": 0, "entries": 0, "salary": 0})
        att = worker_att.get(wid, {"present": 0, "absent": 0, "half_day": 0})
        
        total_att_days = att["present"] + att["absent"] + att["half_day"]
        attendance_rate = (att["present"] + att["half_day"] * 0.5) / total_att_days if total_att_days > 0 else 0
        production_score = (prod["meters"] / max_meters) if max_meters > 0 else 0
        
        # Composite score: 60% production + 40% attendance
        overall_score = round((production_score * 60 + attendance_rate * 40), 1)
        
        results.append({
            "worker_id": wid,
            "worker_name": worker_map.get(wid, wid),
            "total_meters": round(prod["meters"], 2),
            "total_entries": prod["entries"],
            "total_salary": round(prod["salary"], 2),
            "avg_meters_per_entry": round(prod["meters"] / prod["entries"], 2) if prod["entries"] > 0 else 0,
            "days_present": att["present"],
            "days_absent": att["absent"],
            "days_half": att["half_day"],
            "attendance_rate": round(attendance_rate * 100, 1),
            "overall_score": overall_score,
        })
    
    results.sort(key=lambda x: x["overall_score"], reverse=True)
    return results


# --------------------------------------------------
# COMPARATIVE ANALYTICS
# --------------------------------------------------

@router.get("/analytics/compare", tags=["Analytics"])
def comparative_analytics(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Compares current period with previous equal-length period."""
    org_id = ctx["org_id"]
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    period_days = (end_dt - start_dt).days + 1
    
    prev_end = start_dt - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)
    prev_start_str = prev_start.strftime("%Y-%m-%d")
    prev_end_str = prev_end.strftime("%Y-%m-%d")
    
    # Current period
    curr_prod = _get_records(org_id, "production", start_date, end_date)
    curr_meters = sum(r.get("meters", 0) for r in curr_prod)
    curr_salary = sum(r.get("total_amount", 0) for r in curr_prod)
    curr_workers = len(set(r.get("worker_id") for r in curr_prod))
    
    # Previous period
    prev_prod = _get_records(org_id, "production", prev_start_str, prev_end_str)
    prev_meters = sum(r.get("meters", 0) for r in prev_prod)
    prev_salary = sum(r.get("total_amount", 0) for r in prev_prod)
    prev_workers = len(set(r.get("worker_id") for r in prev_prod))
    
    def pct_change(curr, prev):
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)
    
    return {
        "current_period": {"start": start_date, "end": end_date},
        "previous_period": {"start": prev_start_str, "end": prev_end_str},
        "period_days": period_days,
        "production": {
            "current": round(curr_meters, 2),
            "previous": round(prev_meters, 2),
            "change_pct": pct_change(curr_meters, prev_meters),
        },
        "salary": {
            "current": round(curr_salary, 2),
            "previous": round(prev_salary, 2),
            "change_pct": pct_change(curr_salary, prev_salary),
        },
        "workers": {
            "current": curr_workers,
            "previous": prev_workers,
            "change_pct": pct_change(curr_workers, prev_workers),
        },
    }


# --------------------------------------------------
# P&L SUMMARY
# --------------------------------------------------

@router.get("/analytics/pnl", tags=["Analytics"])
def profit_and_loss(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Returns P&L: order revenue - expenses - salaries."""
    org_id = ctx["org_id"]
    
    # Revenue from orders (filtered by date range)
    orders_query = _col(org_id, "orders")
    # Filter orders created within the date range
    if start_date:
        orders_query = orders_query.where("created_at", ">=", start_date)
    if end_date:
        orders_query = orders_query.where("created_at", "<=", end_date + "T23:59:59")
    orders = list(orders_query.stream())
    total_revenue = sum(
        o.to_dict().get("total_value", 0)
        for o in orders
        if o.to_dict().get("status") in ("completed", "delivered")
    )
    
    # Expenses (approved only)
    expenses = _get_records(org_id, "expenses", start_date, end_date)
    approved_expenses = [e for e in expenses if e.get("status") == "approved"]
    total_expenses = sum(e.get("amount", 0) for e in approved_expenses)
    expense_by_cat = {}
    for e in approved_expenses:
        cat = e.get("category", "Other")
        expense_by_cat[cat] = expense_by_cat.get(cat, 0) + e.get("amount", 0)
    
    # Salaries
    production = _get_records(org_id, "production", start_date, end_date)
    total_salaries = sum(r.get("total_amount", 0) for r in production)
    
    gross_profit = total_revenue - total_expenses - total_salaries
    
    return {
        "period": {"start": start_date, "end": end_date},
        "revenue": round(total_revenue, 2),
        "expenses": {
            "total": round(total_expenses, 2),
            "by_category": {k: round(v, 2) for k, v in expense_by_cat.items()},
        },
        "salaries": round(total_salaries, 2),
        "gross_profit": round(gross_profit, 2),
        "margin_pct": round((gross_profit / total_revenue * 100) if total_revenue > 0 else 0, 1),
    }


# --------------------------------------------------
# CSV EXPORT
# --------------------------------------------------

@router.get("/export/{data_type}", tags=["Export"])
def export_csv(
    data_type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ctx=Depends(get_current_org),
):
    """
    Exports data as CSV. data_type: production, workers, attendance, expenses, inventory, orders.
    """
    org_id = ctx["org_id"]
    rows = []
    headers = []
    
    if data_type == "production":
        records = _get_records(org_id, "production", start_date or "2000-01-01", end_date or "2099-12-31")
        headers = ["date", "worker_id", "shed_name", "loom_number", "shift", "meters", "total_amount"]
        rows = [{h: r.get(h, "") for h in headers} for r in records]
    
    elif data_type == "workers":
        workers = crud.get_workers(org_id)
        headers = ["id", "name", "phone", "rate_per_meter"]
        rows = [{h: w.get(h, "") for h in headers} for w in workers]
    
    elif data_type == "attendance":
        records = _get_records(org_id, "attendance", start_date or "2000-01-01", end_date or "2099-12-31")
        headers = ["date", "worker_id", "status", "marked_by", "marked_at"]
        rows = [{h: r.get(h, "") for h in headers} for r in records]
    
    elif data_type == "expenses":
        records = _get_records(org_id, "expenses", start_date or "2000-01-01", end_date or "2099-12-31")
        headers = ["date", "category", "amount", "description", "status", "submitted_email"]
        rows = [{h: r.get(h, "") for h in headers} for r in records]
    
    elif data_type == "inventory":
        items = list(_col(org_id, "inventory").stream())
        headers = ["name", "category", "unit", "current_stock", "min_stock_threshold", "rate_per_unit"]
        rows = [{h: doc.to_dict().get(h, "") for h in headers} for doc in items]
    
    elif data_type == "orders":
        orders_docs = list(_col(org_id, "orders").stream())
        headers = ["customer_id", "fabric_type", "ordered_meters", "produced_meters",
                    "rate_per_meter", "total_value", "status", "deadline"]
        rows = [{h: doc.to_dict().get(h, "") for h in headers} for doc in orders_docs]
    
    else:
        return {"error": f"Unknown data type: {data_type}"}
    
    # Build CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={data_type}_{start_date or 'all'}_{end_date or 'all'}.csv"},
    )


# --------------------------------------------------
# DAILY PRODUCTION TREND
# --------------------------------------------------

@router.get("/analytics/production-trend", tags=["Analytics"])
def production_trend(
    start_date: str = Query(...),
    end_date: str = Query(...),
    ctx=Depends(get_current_org),
):
    """Returns daily production totals for charting."""
    records = _get_records(ctx["org_id"], "production", start_date, end_date)
    
    daily = {}
    for r in records:
        date = r.get("date", "")
        if date not in daily:
            daily[date] = {"date": date, "meters": 0, "entries": 0, "salary": 0}
        daily[date]["meters"] += r.get("meters", 0)
        daily[date]["entries"] += 1
        daily[date]["salary"] += r.get("total_amount", 0)
    
    result = sorted(daily.values(), key=lambda x: x["date"])
    return result
