"""
Tests: Payroll (components, advances, runs, payslips) + Analytics + Billing
"""

import pytest
from unittest.mock import patch, MagicMock
from .conftest import OWNER_TOKEN, SUPERVISOR_TOKEN, OPERATOR_TOKEN, WORKER_ID, ORG_ID, auth_header

COMPONENT = {
    "id": "comp-1", "worker_id": WORKER_ID, "type": "bonus",
    "name": "Festival Bonus", "amount": 500.0, "recurring": False, "active": True,
}
ADVANCE = {
    "id": "adv-1", "worker_id": WORKER_ID, "amount": 2000.0,
    "balance": 2000.0, "status": "active", "issued_date": "2026-03-01",
}
SALARY_DATA = {
    "summary": {"total_meters": 500.0, "total_salary": 2500.0},
    "details": [],
}


def _mock_doc(data, exists=True, doc_id="mock-id"):
    doc = MagicMock()
    doc.exists = exists
    doc.id = doc_id
    doc.to_dict.return_value = data
    return doc


def _mock_col(docs=None):
    col = MagicMock()
    mock_docs = [_mock_doc(d) for d in (docs or [])]
    col.stream.return_value = iter(mock_docs)
    col.where.return_value = col
    col.order_by.return_value = col
    col.limit.return_value = col
    new_ref = MagicMock()
    new_ref.id = "new-id"
    col.document.return_value = new_ref
    return col


# ──────────────────────────────────────────────────────────────────────────────
# SALARY COMPONENTS
# ──────────────────────────────────────────────────────────────────────────────

class TestSalaryComponents:
    def test_add_bonus_component(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/components",
                json={
                    "worker_id": WORKER_ID,
                    "type": "bonus",
                    "name": "Festival Bonus",
                    "amount": 500.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_add_deduction_component(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/components",
                json={
                    "worker_id": WORKER_ID,
                    "type": "deduction",
                    "name": "PF",
                    "amount": 200.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_add_invalid_component_type(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/components",
                json={
                    "worker_id": WORKER_ID,
                    "type": "salary",  # Invalid
                    "name": "Base",
                    "amount": 1000.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_add_negative_amount_component(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/components",
                json={
                    "worker_id": WORKER_ID,
                    "type": "bonus",
                    "name": "Negative",
                    "amount": -100.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_list_components(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col([COMPONENT])):
            r = client.get("/api/v1/payroll/components", headers=auth_header())
        assert r.status_code == 200

    def test_delete_component(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(COMPONENT)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.delete("/api/v1/payroll/components/comp-1", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["status"] == "deactivated"

    def test_delete_component_not_found(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc({}, exists=False)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.delete("/api/v1/payroll/components/ghost-id", headers=auth_header())
        assert r.status_code == 404

    def test_supervisor_cannot_add_component(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.post(
                "/api/v1/payroll/components",
                json={"worker_id": WORKER_ID, "type": "bonus", "name": "B", "amount": 100},
                headers=auth_header(),
            )
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# ADVANCES
# ──────────────────────────────────────────────────────────────────────────────

class TestAdvances:
    def test_issue_advance(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/advances",
                json={"worker_id": WORKER_ID, "amount": 2000.0, "reason": "Emergency"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_issue_advance_zero_amount(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col()):
            r = client.post(
                "/api/v1/payroll/advances",
                json={"worker_id": WORKER_ID, "amount": 0},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_list_advances(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col([ADVANCE])):
            r = client.get("/api/v1/payroll/advances", headers=auth_header())
        assert r.status_code == 200

    def test_repay_advance(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(ADVANCE)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/adv-1/repay",
                json={"amount": 500.0, "notes": "Partial repayment"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["new_balance"] == 1500.0

    def test_repay_advance_full(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(ADVANCE)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/adv-1/repay",
                json={"amount": 2000.0},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["new_balance"] == 0.0
        assert r.json()["status"] == "repaid"

    def test_repay_advance_exceeds_balance(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(ADVANCE)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/adv-1/repay",
                json={"amount": 9999.0},
                headers=auth_header(),
            )
        assert r.status_code == 400
        assert "balance" in r.json()["detail"]

    def test_repay_already_repaid_advance(self, client):
        repaid = {**ADVANCE, "status": "repaid", "balance": 0}
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(repaid)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/adv-1/repay",
                json={"amount": 100.0},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_repay_advance_not_found(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc({}, exists=False)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/ghost-id/repay",
                json={"amount": 100.0},
                headers=auth_header(),
            )
        assert r.status_code == 404

    def test_repay_zero_amount(self, client):
        col = _mock_col()
        col.document.return_value.get.return_value = _mock_doc(ADVANCE)
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=col):
            r = client.post(
                "/api/v1/payroll/advances/adv-1/repay",
                json={"amount": 0},
                headers=auth_header(),
            )
        assert r.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# PAYROLL RUN
# ──────────────────────────────────────────────────────────────────────────────

class TestPayrollRun:
    def test_execute_payroll_run(self, client):
        workers = [{"id": WORKER_ID, "name": "Ravi"}]
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll.crud.get_workers", return_value=workers), \
             patch("app.payroll.crud.calculate_salary", return_value=SALARY_DATA), \
             patch("app.payroll._col", return_value=_mock_col([])), \
             patch("app.payroll.db") as mock_db:
            mock_db.batch.return_value = MagicMock()
            r = client.post(
                "/api/v1/payroll/run",
                json={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "payroll_run_id" in body
        assert "payslips" in body

    def test_payroll_run_no_workers(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll.crud.get_workers", return_value=[]), \
             patch("app.payroll._col", return_value=_mock_col([])), \
             patch("app.payroll.db") as mock_db:
            mock_db.batch.return_value = MagicMock()
            r = client.post(
                "/api/v1/payroll/run",
                json={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["worker_count"] == 0

    def test_payroll_run_missing_dates(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post("/api/v1/payroll/run", json={}, headers=auth_header())
        assert r.status_code == 422

    def test_list_payroll_runs(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll._col", return_value=_mock_col([])):
            r = client.get("/api/v1/payroll/runs", headers=auth_header())
        assert r.status_code == 200

    def test_get_payslip_on_the_fly(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.payroll.crud.calculate_salary", return_value=SALARY_DATA), \
             patch("app.payroll.crud.get_workers", return_value=[{"id": WORKER_ID, "name": "Ravi"}]), \
             patch("app.payroll._col", return_value=_mock_col([])):
            r = client.get(
                f"/api/v1/payroll/payslip/{WORKER_ID}",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "net_salary" in body
        assert "gross_salary" in body

    def test_supervisor_cannot_run_payroll(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.post(
                "/api/v1/payroll/run",
                json={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# ANALYTICS
# ──────────────────────────────────────────────────────────────────────────────

class TestAnalytics:
    def _prod_record(self, worker_id=WORKER_ID):
        return {
            "id": "p1", "worker_id": worker_id, "loom_id": "l1",
            "shed_name": "A", "loom_number": "L01", "date": "2026-03-15",
            "shift": "Day", "meters": 100.0, "total_amount": 500.0,
        }

    def test_loom_efficiency(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[self._prod_record()]):
            r = client.get(
                "/api/v1/analytics/loom-efficiency",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_loom_efficiency_no_data(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[]):
            r = client.get(
                "/api/v1/analytics/loom-efficiency",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json() == []

    def test_worker_performance(self, client):
        workers = [{"id": WORKER_ID, "name": "Ravi"}]
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[self._prod_record()]), \
             patch("app.analytics.crud.get_workers", return_value=workers):
            r = client.get(
                "/api/v1/analytics/worker-performance",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert len(body) >= 1
        assert "overall_score" in body[0]

    def test_comparative_analytics(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[self._prod_record()]):
            r = client.get(
                "/api/v1/analytics/compare",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "current_period" in body
        assert "previous_period" in body
        assert "production" in body

    def test_pnl_summary(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[]), \
             patch("app.analytics._col", return_value=_mock_col([])):
            r = client.get(
                "/api/v1/analytics/pnl",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "revenue" in body
        assert "gross_profit" in body

    def test_production_trend(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[self._prod_record()]):
            r = client.get(
                "/api/v1/analytics/production-trend",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_analytics_missing_dates(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/analytics/loom-efficiency", headers=auth_header())
        assert r.status_code == 422

    def test_audit_log(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics.get_audit_log", return_value=[]):
            r = client.get("/api/v1/analytics/audit-log", headers=auth_header())
        assert r.status_code == 200

    def test_audit_log_limit_validation(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics.get_audit_log", return_value=[]):
            r = client.get(
                "/api/v1/analytics/audit-log",
                params={"limit": 200},  # Exceeds max of 100
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_csv_export_production(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics._get_records", return_value=[]):
            r = client.get(
                "/api/v1/export/production",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]

    def test_csv_export_workers(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.analytics.crud.get_workers", return_value=[]):
            r = client.get("/api/v1/export/workers", headers=auth_header())
        assert r.status_code == 200

    def test_csv_export_invalid_type(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/export/unknown_type", headers=auth_header())
        assert r.status_code == 200
        assert "error" in r.json()


# ──────────────────────────────────────────────────────────────────────────────
# BILLING
# ──────────────────────────────────────────────────────────────────────────────

class TestBilling:
    def test_list_plans(self, client):
        r = client.get("/api/v1/billing/plans", headers=auth_header())
        assert r.status_code == 200
        plans = r.json()
        plan_ids = [p["id"] for p in plans]
        assert "free" in plan_ids
        assert "pro" in plan_ids
        assert "enterprise" in plan_ids

    def test_get_subscription(self, client):
        sub = {"plan": "pro", "status": "active"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.billing.crud.get_subscription", return_value=sub):
            r = client.get("/api/v1/billing/subscription", headers=auth_header())
        assert r.status_code == 200

    def test_get_subscription_none(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.billing.crud.get_subscription", return_value=None):
            r = client.get("/api/v1/billing/subscription", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["plan"] == "free"

    def test_get_usage(self, client):
        usage = {"workers": 3, "sheds": 1, "members": 2, "production_entries_this_month": 50}
        sub = {"plan": "pro", "status": "active"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.billing.crud.get_subscription", return_value=sub), \
             patch("app.billing.crud.get_usage", return_value=usage):
            r = client.get("/api/v1/billing/usage", headers=auth_header())
        assert r.status_code == 200
        assert "utilization" in r.json()

    def test_checkout_invalid_plan(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/billing/checkout",
                params={"plan_id": "invalid_plan"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_checkout_free_plan_rejected(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/billing/checkout",
                params={"plan_id": "free"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_checkout_invalid_billing_cycle(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/billing/checkout",
                params={"plan_id": "pro", "billing_cycle": "weekly"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_checkout_no_razorpay_config(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.billing.RAZORPAY_KEY_ID", ""), \
             patch("app.billing.RAZORPAY_KEY_SECRET", ""):
            r = client.post(
                "/api/v1/billing/checkout",
                params={"plan_id": "pro", "billing_cycle": "monthly"},
                headers=auth_header(),
            )
        assert r.status_code == 503

    def test_checkout_supervisor_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.post(
                "/api/v1/billing/checkout",
                params={"plan_id": "pro"},
                headers=auth_header(),
            )
        assert r.status_code == 403

    def test_downgrade_to_free(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.billing.crud.update_subscription"):
            r = client.post("/api/v1/billing/downgrade-to-free", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["plan"] == "free"

    def test_webhook_missing_secret(self, client):
        with patch("app.billing.RAZORPAY_WEBHOOK_SECRET", ""):
            r = client.post(
                "/api/v1/billing/webhooks/razorpay",
                content=b'{"event":"subscription.activated"}',
                headers={"Content-Type": "application/json"},
            )
        assert r.status_code == 503

    def test_webhook_invalid_signature(self, client):
        with patch("app.billing.RAZORPAY_WEBHOOK_SECRET", "test-secret"):
            r = client.post(
                "/api/v1/billing/webhooks/razorpay",
                content=b'{"event":"subscription.activated"}',
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": "bad-signature",
                },
            )
        assert r.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# SAAS ADMIN
# ──────────────────────────────────────────────────────────────────────────────

class TestSaasAdmin:
    def test_list_all_orgs_super_admin(self, client):
        super_token = {**OWNER_TOKEN, "email": "yugendharanmohan@gmail.com"}
        with patch("firebase_admin.auth.verify_id_token", return_value=super_token), \
             patch("app.main.db") as mock_db:
            mock_db.collection.return_value.stream.return_value = iter([])
            r = client.get("/api/v1/admin/organizations", headers=auth_header())
        assert r.status_code == 200

    def test_list_all_orgs_non_super_admin_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/admin/organizations", headers=auth_header())
        assert r.status_code == 403

    def test_disable_org_super_admin(self, client):
        super_token = {**OWNER_TOKEN, "email": "yugendharanmohan@gmail.com"}
        with patch("firebase_admin.auth.verify_id_token", return_value=super_token), \
             patch("app.main.db") as mock_db:
            doc = MagicMock()
            doc.exists = True
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            r = client.put(
                f"/api/v1/admin/organizations/{ORG_ID}/disable",
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_enable_org_not_found(self, client):
        super_token = {**OWNER_TOKEN, "email": "yugendharanmohan@gmail.com"}
        with patch("firebase_admin.auth.verify_id_token", return_value=super_token), \
             patch("app.main.db") as mock_db:
            doc = MagicMock()
            doc.exists = False
            mock_db.collection.return_value.document.return_value.get.return_value = doc
            r = client.put(
                "/api/v1/admin/organizations/ghost-org/enable",
                headers=auth_header(),
            )
        assert r.status_code == 404
