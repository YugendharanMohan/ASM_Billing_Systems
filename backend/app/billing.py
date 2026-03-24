"""
Billing router: Razorpay checkout, webhooks, subscription management, and usage dashboard.

Razorpay flow:
1. Frontend calls POST /billing/checkout → backend creates Razorpay subscription → returns subscription_id
2. Frontend opens Razorpay checkout modal with the subscription_id
3. On success, Razorpay sends webhook to POST /billing/webhooks/razorpay
4. Backend verifies webhook signature and updates subscription status
"""

import os
import hmac
import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status

from .auth import get_current_org, owner_required
from .crud import crud
from .plans import (
    PLANS, get_plan, get_plan_limits, get_effective_plan,
    is_subscription_active, SubscriptionStatus,
)

router = APIRouter()

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")


# --------------------------------------------------
# BILLING DASHBOARD
# --------------------------------------------------

@router.get("/billing/plans", tags=["Billing"])
def list_plans():
    """Returns all available plans with their limits and pricing."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "price_monthly": p.price_monthly_inr / 100,  # Convert paise to INR
            "price_yearly": p.price_yearly_inr / 100,
            "trial_days": p.trial_days,
            "limits": p.limits.dict(),
        }
        for p in PLANS.values()
    ]


@router.get("/billing/subscription", tags=["Billing"])
def get_subscription(ctx=Depends(get_current_org)):
    """Returns the current org's subscription details."""
    sub = crud.get_subscription(ctx["org_id"])
    if not sub:
        return {"plan": "free", "status": "none", "is_active": False}
    
    plan = get_plan(sub.get("plan", "free"))
    return {
        **sub,
        "plan_name": plan.name,
        "plan_limits": plan.limits.dict(),
        "is_active": is_subscription_active(sub),
    }


@router.get("/billing/usage", tags=["Billing"])
def get_usage(ctx=Depends(get_current_org)):
    """Returns usage vs limits for the current org."""
    sub = crud.get_subscription(ctx["org_id"])
    effective_plan = get_effective_plan(sub)
    limits = get_plan_limits(effective_plan)
    usage = crud.get_usage(ctx["org_id"])
    
    return {
        "plan": effective_plan,
        "usage": usage,
        "limits": limits.dict(),
        "utilization": {
            "workers": f"{usage['workers']}/{limits.max_workers}",
            "sheds": f"{usage['sheds']}/{limits.max_sheds}",
            "members": f"{usage['members']}/{limits.max_members}",
            "production_entries": f"{usage['production_entries_this_month']}/{limits.max_production_entries_per_month}",
        },
    }


@router.get("/billing/invoices", tags=["Billing"])
def get_invoices(ctx=Depends(get_current_org)):
    """Returns invoice history for the current org."""
    return crud.get_invoices(ctx["org_id"])


# --------------------------------------------------
# CHECKOUT: Create a Razorpay subscription
# --------------------------------------------------

@router.post("/billing/checkout", tags=["Billing"])
def create_checkout(
    plan_id: str,
    billing_cycle: str = "monthly",
    ctx=Depends(owner_required),
):
    """
    Creates a Razorpay subscription for the org.
    The frontend uses the returned subscription_id to open Razorpay's checkout.
    
    Requires: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.
    """
    if plan_id not in PLANS or plan_id == "free":
        raise HTTPException(status_code=400, detail="Invalid plan. Choose 'pro' or 'enterprise'.")
    
    if billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Billing cycle must be 'monthly' or 'yearly'.")
    
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Payment gateway not configured. Please contact support."
        )
    
    plan = PLANS[plan_id]
    razorpay_plan_id = (
        plan.razorpay_plan_id_monthly if billing_cycle == "monthly"
        else plan.razorpay_plan_id_yearly
    )
    
    if not razorpay_plan_id:
        raise HTTPException(
            status_code=503,
            detail=f"Razorpay plan not configured for {plan_id}/{billing_cycle}."
        )
    
    # Create Razorpay subscription via API
    import requests
    response = requests.post(
        "https://api.razorpay.com/v1/subscriptions",
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        json={
            "plan_id": razorpay_plan_id,
            "total_count": 12 if billing_cycle == "monthly" else 1,
            "quantity": 1,
            "notes": {
                "org_id": ctx["org_id"],
                "plan": plan_id,
                "billing_cycle": billing_cycle,
            },
        },
    )
    
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Razorpay error: {response.json().get('error', {}).get('description', 'Unknown error')}"
        )
    
    rz_sub = response.json()
    
    # Store the pending subscription
    crud.update_subscription(ctx["org_id"], {
        "plan": plan_id,
        "status": SubscriptionStatus.ACTIVE,  # Will be confirmed by webhook
        "razorpay_subscription_id": rz_sub["id"],
        "billing_cycle": billing_cycle,
        "current_period_start": datetime.utcnow().isoformat(),
    })
    
    return {
        "subscription_id": rz_sub["id"],
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "plan": plan_id,
        "amount": plan.price_monthly_inr if billing_cycle == "monthly" else plan.price_yearly_inr,
    }


# --------------------------------------------------
# WEBHOOK: Razorpay events
# --------------------------------------------------

@router.post("/billing/webhooks/razorpay", tags=["Billing"])
async def razorpay_webhook(request: Request):
    """
    Handles Razorpay webhook events.
    Verifies signature, then processes subscription lifecycle events.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    
    # Verify webhook signature
    if RAZORPAY_WEBHOOK_SECRET:
        expected = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    
    payload = json.loads(body)
    event = payload.get("event", "")
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    
    org_id = entity.get("notes", {}).get("org_id")
    if not org_id:
        return {"status": "ignored", "reason": "no org_id in notes"}
    
    now = datetime.utcnow().isoformat()
    
    # Handle subscription events
    if event == "subscription.activated":
        crud.update_subscription(org_id, {
            "status": SubscriptionStatus.ACTIVE,
            "current_period_start": now,
            "current_period_end": entity.get("current_end", ""),
            "razorpay_customer_id": entity.get("customer_id"),
        })
    
    elif event == "subscription.charged":
        # Payment successful — record invoice
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        crud.add_invoice(org_id, {
            "razorpay_payment_id": payment.get("id"),
            "amount": payment.get("amount", 0) / 100,  # paise → INR
            "currency": payment.get("currency", "INR"),
            "status": "paid",
            "created_at": now,
            "method": payment.get("method", ""),
        })
        crud.update_subscription(org_id, {
            "status": SubscriptionStatus.ACTIVE,
            "current_period_end": entity.get("current_end", ""),
        })
    
    elif event == "subscription.pending":
        crud.update_subscription(org_id, {
            "status": SubscriptionStatus.PAST_DUE,
        })
    
    elif event in ("subscription.halted", "subscription.cancelled"):
        crud.update_subscription(org_id, {
            "status": SubscriptionStatus.CANCELLED,
            "cancelled_at": now,
        })
    
    elif event == "subscription.completed":
        crud.update_subscription(org_id, {
            "status": SubscriptionStatus.EXPIRED,
        })
    
    return {"status": "ok", "event": event}


# --------------------------------------------------
# MANUAL PLAN CHANGE (for admin/support)
# --------------------------------------------------

@router.post("/billing/downgrade-to-free", tags=["Billing"])
def downgrade_to_free(ctx=Depends(owner_required)):
    """Downgrades org to free plan (cancels subscription)."""
    crud.update_subscription(ctx["org_id"], {
        "plan": "free",
        "status": SubscriptionStatus.CANCELLED,
        "cancelled_at": datetime.utcnow().isoformat(),
        "razorpay_subscription_id": None,
    })
    return {"status": "downgraded", "plan": "free"}
