"""
Tests: Workers, Sheds/Looms, Production, Salary endpoints
"""

import pytest
from unittest.mock import patch, MagicMock
from .conftest import (
    OWNER_TOKEN, SUPERVISOR_TOKEN, OPERATOR_TOKEN,
    ORG_ID, WORKER_ID, auth_header,
)

WORKER = {"id": WORKER_ID, "name": "Ravi Kumar", "phone": "9876543210"}
SHED = {"id": "shed-1", "name": "Shed A"}
LOOM = {"id": "loom-1", "shed_id": "shed-1", "loom_number": "L01"}
PRODUCTION_ENTRY = {
    "id": "prod-1",
    "worker_id": WORKER_ID,
    "loom_id": "loom-1",
    "shed_name": "Shed A",
    "loom_number": "L01",
    "date": "2026-03-01",
    "shift": "Day",
    "meters": 120.5,
    "rate": 5.0,
    "total_amount": 602.5,
}


# ──────────────────────────────────────────────────────────────────────────────
# WORKERS
# ──────────────────────────────────────────────────────────────────────────────

class TestWorkers:
    def test_create_worker_as_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.create_worker", return_value=WORKER), \
             patch("app.main.crud.get_subscription", return_value={"plan": "pro", "status": "active"}), \
             patch("app.main.crud.get_workers", return_value=[]):
            r = client.post(
                "/api/v1/workers/",
                json={"name": "Ravi Kumar", "phone": "9876543210"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["name"] == "Ravi Kumar"

    def test_create_worker_missing_name(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post("/api/v1/workers/", json={}, headers=auth_header())
        assert r.status_code == 422

    def test_create_worker_as_supervisor_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.post(
                "/api/v1/workers/",
                json={"name": "Test"},
                headers=auth_header(),
            )
        assert r.status_code == 403

    def test_list_workers(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_workers", return_value=[WORKER]):
            r = client.get("/api/v1/workers/", headers=auth_header())
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_list_workers_empty(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_workers", return_value=[]):
            r = client.get("/api/v1/workers/", headers=auth_header())
        assert r.status_code == 200
        assert r.json() == []

    def test_update_worker_as_owner(self, client):
        updated = {**WORKER, "name": "Ravi Updated"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.update_worker", return_value=updated):
            r = client.put(
                f"/api/v1/workers/{WORKER_ID}",
                json={"name": "Ravi Updated"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["name"] == "Ravi Updated"

    def test_update_worker_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.update_worker", return_value=None):
            r = client.put(
                "/api/v1/workers/ghost-id",
                json={"name": "Ghost"},
                headers=auth_header(),
            )
        assert r.status_code == 404

    def test_delete_worker_as_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.delete_worker", return_value=True):
            r = client.delete(f"/api/v1/workers/{WORKER_ID}", headers=auth_header())
        assert r.status_code == 200

    def test_delete_worker_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.delete_worker", return_value=False):
            r = client.delete("/api/v1/workers/ghost-id", headers=auth_header())
        assert r.status_code == 404

    def test_no_auth_list_workers(self, client):
        r = client.get("/api/v1/workers/")
        assert r.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# SHEDS & LOOMS
# ──────────────────────────────────────────────────────────────────────────────

class TestShedsLooms:
    def test_create_shed(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.create_shed", return_value=SHED), \
             patch("app.main.crud.get_subscription", return_value={"plan": "pro", "status": "active"}), \
             patch("app.main.crud.get_workers", return_value=[]):
            r = client.post(
                "/api/v1/sheds/",
                params={"name": "Shed A"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_get_shed_hierarchy(self, client):
        hierarchy = [{"id": "shed-1", "name": "Shed A", "looms": [LOOM]}]
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_hierarchy", return_value=hierarchy):
            r = client.get("/api/v1/sheds-looms/", headers=auth_header())
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_create_loom(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.create_loom", return_value=LOOM):
            r = client.post(
                "/api/v1/looms/",
                params={"shed_id": "shed-1", "loom_num": "L01"},
                headers=auth_header(),
            )
        assert r.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# PRODUCTION
# ──────────────────────────────────────────────────────────────────────────────

class TestProduction:
    def test_add_production_entry(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.salary.crud.add_production", return_value=PRODUCTION_ENTRY):
            r = client.post(
                "/api/v1/production/",
                json={
                    "worker_id": WORKER_ID,
                    "loom_id": "loom-1",
                    "shed_name": "Shed A",
                    "loom_number": "L01",
                    "date": "2026-03-01",
                    "shift": "Day",
                    "meters": 120.5,
                    "rate": 5.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_add_production_invalid_shift(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/production/",
                json={
                    "worker_id": WORKER_ID,
                    "loom_id": "loom-1",
                    "shed_name": "Shed A",
                    "loom_number": "L01",
                    "date": "2026-03-01",
                    "shift": "Evening",  # Invalid
                    "meters": 100,
                    "rate": 5.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_add_production_negative_meters(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/production/",
                json={
                    "worker_id": WORKER_ID,
                    "loom_id": "loom-1",
                    "shed_name": "Shed A",
                    "loom_number": "L01",
                    "date": "2026-03-01",
                    "shift": "Day",
                    "meters": -10,  # Invalid
                    "rate": 5.0,
                },
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_add_production_zero_rate(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/production/",
                json={
                    "worker_id": WORKER_ID,
                    "loom_id": "loom-1",
                    "shed_name": "Shed A",
                    "loom_number": "L01",
                    "date": "2026-03-01",
                    "shift": "Night",
                    "meters": 100,
                    "rate": 0,  # Invalid
                },
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_get_production_history(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_production_history", return_value=[PRODUCTION_ENTRY]):
            r = client.get(
                "/api/v1/production/history",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_get_production_history_missing_dates(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/production/history", headers=auth_header())
        assert r.status_code == 422

    def test_delete_production_entry(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.delete_production", return_value=True):
            r = client.delete("/api/v1/production/prod-1", headers=auth_header())
        assert r.status_code == 200

    def test_delete_production_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.delete_production", return_value=False):
            r = client.delete("/api/v1/production/ghost-id", headers=auth_header())
        assert r.status_code == 404

    def test_update_production_entry(self, client):
        updated = {**PRODUCTION_ENTRY, "meters": 150.0}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.update_production", return_value=updated):
            r = client.put(
                "/api/v1/production/prod-1",
                json={"meters": 150.0},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_supervisor_cannot_delete_production(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.delete("/api/v1/production/prod-1", headers=auth_header())
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# SALARY CALCULATION
# ──────────────────────────────────────────────────────────────────────────────

class TestSalaryCalculation:
    def test_calculate_salary(self, client):
        salary_result = {
            "summary": {"total_meters": 500.0, "total_salary": 2500.0},
            "details": [PRODUCTION_ENTRY],
        }
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.salary.crud.calculate_salary", return_value=salary_result):
            r = client.get(
                "/api/v1/salary/calculate",
                params={
                    "worker_id": WORKER_ID,
                    "start_date": "2026-03-01",
                    "end_date": "2026-03-31",
                },
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["summary"]["total_salary"] == 2500.0

    def test_calculate_salary_missing_worker_id(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get(
                "/api/v1/salary/calculate",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_calculate_salary_invalid_date_format(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get(
                "/api/v1/salary/calculate",
                params={
                    "worker_id": WORKER_ID,
                    "start_date": "01-03-2026",  # Wrong format
                    "end_date": "31-03-2026",
                },
                headers=auth_header(),
            )
        assert r.status_code == 422


# ──────────────────────────────────────────────────────────────────────────────
# OPERATOR PORTAL (row-level security)
# ──────────────────────────────────────────────────────────────────────────────

class TestOperatorPortal:
    def test_operator_can_view_own_production(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OPERATOR_TOKEN), \
             patch("app.main.crud.get_production_history", return_value=[PRODUCTION_ENTRY]):
            r = client.get(
                "/api/v1/me/production",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_operator_analytics(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OPERATOR_TOKEN), \
             patch("app.main.crud.get_production_history", return_value=[PRODUCTION_ENTRY]):
            r = client.get(
                "/api/v1/me/analytics",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "total_meters" in body
        assert "total_earnings" in body
