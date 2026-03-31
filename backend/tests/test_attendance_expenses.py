"""
Tests: Attendance, Leave Requests, Expenses endpoints
"""

import pytest
from unittest.mock import patch, MagicMock
from .conftest import OWNER_TOKEN, SUPERVISOR_TOKEN, OPERATOR_TOKEN, ORG_ID, WORKER_ID, auth_header

ATT_RECORD = {
    "id": "att-1",
    "worker_id": WORKER_ID,
    "date": "2026-03-15",
    "status": "Present",
    "marked_by": "owner-uid-001",
    "marked_at": "2026-03-15T08:00:00",
}

LEAVE_REQUEST = {
    "id": "leave-1",
    "worker_id": WORKER_ID,
    "start_date": "2026-03-20",
    "end_date": "2026-03-22",
    "reason": "Personal",
    "status": "pending",
}

EXPENSE = {
    "id": "exp-1",
    "category": "Electricity",
    "amount": 5000.0,
    "description": "March bill",
    "date": "2026-03-15",
    "status": "pending",
    "submitted_by": "owner-uid-001",
}


# ──────────────────────────────────────────────────────────────────────────────
# ATTENDANCE
# ──────────────────────────────────────────────────────────────────────────────

class TestAttendance:
    def test_mark_attendance_present(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._mark_attendance", return_value=ATT_RECORD):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Present"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["status"] == "Present"

    def test_mark_attendance_absent(self, client):
        record = {**ATT_RECORD, "status": "Absent"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._mark_attendance", return_value=record):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Absent"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_mark_attendance_half_day(self, client):
        record = {**ATT_RECORD, "status": "Half-Day"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._mark_attendance", return_value=record):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Half-Day"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_mark_attendance_invalid_status(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Late"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_mark_attendance_missing_fields(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_bulk_mark_attendance(self, client):
        results = {"count": 2, "records": [ATT_RECORD, {**ATT_RECORD, "worker_id": "w2"}]}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._mark_attendance", return_value=ATT_RECORD):
            r = client.post(
                "/api/v1/attendance/bulk",
                json={
                    "date": "2026-03-15",
                    "entries": [
                        {"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Present"},
                        {"worker_id": "w2", "date": "2026-03-15", "status": "Absent"},
                    ],
                },
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["count"] == 2

    def test_bulk_mark_empty_entries(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._mark_attendance", return_value=ATT_RECORD):
            r = client.post(
                "/api/v1/attendance/bulk",
                json={"date": "2026-03-15", "entries": []},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_get_attendance_by_date(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._get_attendance", return_value=[ATT_RECORD]):
            r = client.get(
                "/api/v1/attendance/",
                params={"date": "2026-03-15"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_get_attendance_summary(self, client):
        summary = {
            "worker_id": WORKER_ID,
            "present": 20, "absent": 5, "half_day": 2,
            "effective_days": 21.0, "total_records": 27,
        }
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._get_attendance_summary", return_value=summary):
            r = client.get(
                f"/api/v1/attendance/summary/{WORKER_ID}",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["present"] == 20

    def test_get_daily_report(self, client):
        from unittest.mock import patch as p
        workers = [{"id": WORKER_ID, "name": "Ravi"}]
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance.crud.get_workers", return_value=workers), \
             patch("app.attendance._get_attendance", return_value=[ATT_RECORD]):
            r = client.get(
                "/api/v1/attendance/daily/2026-03-15",
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "present" in body
        assert "workers" in body

    def test_operator_cannot_mark_attendance(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OPERATOR_TOKEN):
            r = client.post(
                "/api/v1/attendance/mark",
                json={"worker_id": WORKER_ID, "date": "2026-03-15", "status": "Present"},
                headers=auth_header(),
            )
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# LEAVE REQUESTS
# ──────────────────────────────────────────────────────────────────────────────

class TestLeaveRequests:
    def test_create_leave_request(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._create_leave_request", return_value=LEAVE_REQUEST):
            r = client.post(
                "/api/v1/leave/request",
                json={
                    "worker_id": WORKER_ID,
                    "start_date": "2026-03-20",
                    "end_date": "2026-03-22",
                    "reason": "Personal",
                },
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_list_leave_requests(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._get_leave_requests", return_value=[LEAVE_REQUEST]):
            r = client.get("/api/v1/leave/requests", headers=auth_header())
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_list_leave_requests_filter_by_status(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._get_leave_requests", return_value=[]):
            r = client.get(
                "/api/v1/leave/requests",
                params={"status": "approved"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_approve_leave_request(self, client):
        approved = {**LEAVE_REQUEST, "status": "approved"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._review_leave_request", return_value=approved):
            r = client.put(
                "/api/v1/leave/requests/leave-1",
                json={"status": "approved", "reviewer_note": "OK"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    def test_reject_leave_request(self, client):
        rejected = {**LEAVE_REQUEST, "status": "rejected"}
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._review_leave_request", return_value=rejected):
            r = client.put(
                "/api/v1/leave/requests/leave-1",
                json={"status": "rejected"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_review_leave_invalid_status(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.put(
                "/api/v1/leave/requests/leave-1",
                json={"status": "maybe"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_review_leave_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.attendance._review_leave_request", return_value=None):
            r = client.put(
                "/api/v1/leave/requests/ghost-id",
                json={"status": "approved"},
                headers=auth_header(),
            )
        assert r.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# EXPENSES
# ──────────────────────────────────────────────────────────────────────────────

class TestExpenses:
    def test_list_categories(self, client):
        r = client.get("/api/v1/expenses/categories", headers=auth_header())
        assert r.status_code == 200
        assert "Electricity" in r.json()

    def test_create_expense(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc_ref = MagicMock()
            doc_ref.id = "exp-new"
            mock_col.return_value.document.return_value = doc_ref
            r = client.post(
                "/api/v1/expenses/",
                json={
                    "category": "Electricity",
                    "amount": 5000.0,
                    "description": "March bill",
                    "date": "2026-03-15",
                },
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_create_expense_negative_amount(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/expenses/",
                json={"category": "Electricity", "amount": -100, "date": "2026-03-15"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_create_expense_zero_amount(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/expenses/",
                json={"category": "Electricity", "amount": 0, "date": "2026-03-15"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_list_expenses(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.id = "exp-1"
            doc.to_dict.return_value = EXPENSE
            mock_col.return_value.stream.return_value = iter([doc])
            mock_col.return_value.where.return_value = mock_col.return_value
            r = client.get("/api/v1/expenses/", headers=auth_header())
        assert r.status_code == 200

    def test_approve_expense(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {**EXPENSE, "status": "approved"}
            mock_col.return_value.document.return_value.get.return_value = doc
            mock_col.return_value.document.return_value.update = MagicMock()
            r = client.put(
                "/api/v1/expenses/exp-1/approve",
                json={"status": "approved", "note": "Verified"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_approve_expense_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.exists = False
            mock_col.return_value.document.return_value.get.return_value = doc
            r = client.put(
                "/api/v1/expenses/ghost-id/approve",
                json={"status": "approved"},
                headers=auth_header(),
            )
        assert r.status_code == 404

    def test_approve_expense_invalid_status(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.put(
                "/api/v1/expenses/exp-1/approve",
                json={"status": "maybe"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_delete_expense(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.exists = True
            mock_col.return_value.document.return_value.get.return_value = doc
            r = client.delete("/api/v1/expenses/exp-1", headers=auth_header())
        assert r.status_code == 200

    def test_delete_expense_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.exists = False
            mock_col.return_value.document.return_value.get.return_value = doc
            r = client.delete("/api/v1/expenses/ghost-id", headers=auth_header())
        assert r.status_code == 404

    def test_expense_summary(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.expenses._col") as mock_col:
            doc = MagicMock()
            doc.to_dict.return_value = {**EXPENSE, "status": "approved"}
            mock_col.return_value.where.return_value.stream.return_value = iter([doc])
            mock_col.return_value.where.return_value.where.return_value = mock_col.return_value
            r = client.get(
                "/api/v1/expenses/summary",
                params={"start_date": "2026-03-01", "end_date": "2026-03-31"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert "total" in body
        assert "by_category" in body

    def test_expense_summary_missing_dates(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/expenses/summary", headers=auth_header())
        assert r.status_code == 422

    def test_operator_cannot_approve_expense(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OPERATOR_TOKEN):
            r = client.put(
                "/api/v1/expenses/exp-1/approve",
                json={"status": "approved"},
                headers=auth_header(),
            )
        assert r.status_code == 403
