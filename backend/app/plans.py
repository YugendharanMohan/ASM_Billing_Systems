"""
Plan definitions for the ASM SaaS billing system.

Defines plan tiers, limits, and pricing. This is the single source of truth
for what each plan allows — both the backend middleware and frontend UI
read from these definitions.
"""

from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel


# --------------------------------------------------
# PLAN CONFIG
# --------------------------------------------------

class PlanLimits(BaseModel):
    max_workers: int
    max_sheds: int
    max_looms_per_shed: int
    max_production_entries_per_month: int
    history_days: int               # How many days of history are accessible
    allow_pdf_export: bool
    allow_csv_export: bool
    allow_invite_members: bool
    max_members: int

class PlanDefinition(BaseModel):
    id: str
    name: str
    price_monthly_inr: int          # Price in INR (paise for Razorpay)
    price_yearly_inr: int
    razorpay_plan_id_monthly: str   # Set from env or Razorpay dashboard
    razorpay_plan_id_yearly: str
    trial_days: int
    limits: PlanLimits


# --------------------------------------------------
# PLAN DEFINITIONS
# --------------------------------------------------

PLANS = {
    "free": PlanDefinition(
        id="free",
        name="Free",
        price_monthly_inr=0,
        price_yearly_inr=0,
        razorpay_plan_id_monthly="",
        razorpay_plan_id_yearly="",
        trial_days=0,
        limits=PlanLimits(
            max_workers=5,
            max_sheds=1,
            max_looms_per_shed=4,
            max_production_entries_per_month=100,
            history_days=30,
            allow_pdf_export=False,
            allow_csv_export=False,
            allow_invite_members=False,
            max_members=1,
        ),
    ),
    "pro": PlanDefinition(
        id="pro",
        name="Pro",
        price_monthly_inr=999_00,   # ₹999 in paise
        price_yearly_inr=9999_00,   # ₹9,999 in paise (save ₹1,989)
        razorpay_plan_id_monthly="",  # Set from RAZORPAY_PRO_MONTHLY_PLAN_ID env
        razorpay_plan_id_yearly="",
        trial_days=14,
        limits=PlanLimits(
            max_workers=50,
            max_sheds=10,
            max_looms_per_shed=20,
            max_production_entries_per_month=5000,
            history_days=365,
            allow_pdf_export=True,
            allow_csv_export=True,
            allow_invite_members=True,
            max_members=10,
        ),
    ),
    "enterprise": PlanDefinition(
        id="enterprise",
        name="Enterprise",
        price_monthly_inr=4999_00,  # ₹4,999 in paise
        price_yearly_inr=49999_00,  # ₹49,999 in paise
        razorpay_plan_id_monthly="",
        razorpay_plan_id_yearly="",
        trial_days=14,
        limits=PlanLimits(
            max_workers=999,
            max_sheds=999,
            max_looms_per_shed=999,
            max_production_entries_per_month=99999,
            history_days=9999,     # Effectively unlimited
            allow_pdf_export=True,
            allow_csv_export=True,
            allow_invite_members=True,
            max_members=50,
        ),
    ),
}

DEFAULT_PLAN = "free"
TRIAL_PLAN = "pro"   # Trial gives Pro features for trial_days


# --------------------------------------------------
# SUBSCRIPTION STATUS
# --------------------------------------------------

class SubscriptionStatus:
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def get_plan(plan_id: str) -> PlanDefinition:
    """Returns plan definition, falls back to free."""
    return PLANS.get(plan_id, PLANS["free"])


def get_plan_limits(plan_id: str) -> PlanLimits:
    """Returns just the limits for a plan."""
    return get_plan(plan_id).limits


def create_trial_subscription() -> dict:
    """Returns subscription data for a new trial."""
    trial_plan = PLANS[TRIAL_PLAN]
    now = datetime.utcnow()
    return {
        "plan": TRIAL_PLAN,
        "status": SubscriptionStatus.TRIALING,
        "trial_start": now.isoformat(),
        "trial_end": (now + timedelta(days=trial_plan.trial_days)).isoformat(),
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=trial_plan.trial_days)).isoformat(),
        "razorpay_subscription_id": None,
        "razorpay_customer_id": None,
        "billing_cycle": None,
        "created_at": now.isoformat(),
    }


def is_subscription_active(sub: dict) -> bool:
    """Checks if a subscription is in a usable state (active or trialing)."""
    status = sub.get("status")
    if status == SubscriptionStatus.ACTIVE:
        return True
    if status == SubscriptionStatus.TRIALING:
        trial_end = sub.get("trial_end", "")
        if trial_end:
            return datetime.utcnow() < datetime.fromisoformat(trial_end)
    return False


def get_effective_plan(sub: Optional[dict]) -> str:
    """Returns the effective plan ID considering subscription status."""
    if not sub:
        return DEFAULT_PLAN
    if is_subscription_active(sub):
        return sub.get("plan", DEFAULT_PLAN)
    return DEFAULT_PLAN  # Expired/cancelled → fall back to free
