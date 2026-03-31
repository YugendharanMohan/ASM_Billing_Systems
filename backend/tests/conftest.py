"""
conftest.py — Shared fixtures for all tests.

Strategy:
- Mock Firebase token verification so no real Firebase project is needed.
- Mock Firestore db so no real database calls are made.
- Provide role-specific auth headers: owner, admin, supervisor, operator.
- Provide a pre-configured TestClient for each test.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

# ──────────────────────────────────────────────────────────────────────────────
# MOCK TOKENS — decoded Firebase token payloads per role
# ──────────────────────────────────────────────────────────────────────────────

ORG_ID = "test-org-123"
OWNER_UID = "owner-uid-001"
ADMIN_UID = "admin-uid-002"
SUPERVISOR_UID = "supervisor-uid-003"
OPERATOR_UID = "operator-uid-004"
WORKER_ID = "worker-id-001"

OWNER_TOKEN = {
    "uid": OWNER_UID,
    "email": "owner@test.com",
    "org_id": ORG_ID,
    "org_role": "Owner",
}

ADMIN_TOKEN = {
    "uid": ADMIN_UID,
    "email": "admin@test.com",
    "org_id": ORG_ID,
    "org_role": "Admin",
}

SUPERVISOR_TOKEN = {
    "uid": SUPERVISOR_UID,
    "email": "supervisor@test.com",
    "org_id": ORG_ID,
    "org_role": "Supervisor",
}

OPERATOR_TOKEN = {
    "uid": OPERATOR_UID,
    "email": "operator@test.com",
    "org_id": ORG_ID,
    "org_role": "Operator",
    "linked_worker_id": WORKER_ID,
}

NO_ORG_TOKEN = {
    "uid": "no-org-uid",
    "email": "noorg@test.com",
    "org_id": None,
    "org_role": None,
}


def _make_firestore_mock():
    """Returns a fully mocked Firestore client."""
    mock_db = MagicMock()

    def _make_doc(data: dict, exists: bool = True, doc_id: str = "mock-doc-id"):
        doc = MagicMock()
        doc.exists = exists
        doc.id = doc_id
        doc.to_dict.return_value = data
        doc.reference = MagicMock()
        doc.reference.update = MagicMock()
        doc.reference.delete = MagicMock()
        return doc

    def _make_collection(*docs_data):
        col = MagicMock()
        mock_docs = [_make_doc(d, doc_id=f"doc-{i}") for i, d in enumerate(docs_data)]
        col.stream.return_value = iter(mock_docs)
        col.where.return_value = col
        col.order_by.return_value = col
        col.limit.return_value = col
        new_doc_ref = MagicMock()
        new_doc_ref.id = "new-doc-id"
        new_doc_ref.get.return_value = _make_doc({}, exists=False)
        col.document.return_value = new_doc_ref
        return col

    mock_db.collection.return_value = _make_collection()
    mock_db.transaction.return_value = MagicMock()
    mock_db.batch.return_value = MagicMock()
    return mock_db


@pytest.fixture(scope="function")
def mock_db():
    return _make_firestore_mock()


@pytest.fixture(scope="function")
def client(mock_db):
    """TestClient with all external dependencies mocked."""
    with patch("firebase_admin.auth.verify_id_token") as mock_verify, \
         patch("firebase_admin._apps", {"[DEFAULT]": MagicMock()}), \
         patch("firebase_admin.initialize_app"), \
         patch("google.cloud.firestore.Client", return_value=mock_db):

        # Default: verify_id_token returns owner token
        mock_verify.return_value = OWNER_TOKEN

        from app.main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            c._mock_verify = mock_verify
            yield c


def auth_header(token_str: str = "mock-token") -> dict:
    return {"Authorization": f"Bearer {token_str}"}
