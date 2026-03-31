"""
Tests: Organization + Member management endpoints
"""

import pytest
from unittest.mock import patch, MagicMock
from .conftest import (
    OWNER_TOKEN, ADMIN_TOKEN, SUPERVISOR_TOKEN, OPERATOR_TOKEN,
    NO_ORG_TOKEN, ORG_ID, OWNER_UID, auth_header,
)


def _org_doc(extra=None):
    base = {
        "name": "Test Org",
        "industry": "Textile / Loom",
        "phone": "9999999999",
        "owner_uid": OWNER_UID,
        "plan": "trial",
        "member_count": 1,
    }
    if extra:
        base.update(extra)
    return base


# ──────────────────────────────────────────────────────────────────────────────
# CREATE ORGANIZATION
# ──────────────────────────────────────────────────────────────────────────────

class TestCreateOrganization:
    def test_create_org_success(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN), \
             patch("app.main.crud.create_organization", return_value={"id": "new-org", "name": "My Org"}), \
             patch("app.main.set_user_claims"):
            r = client.post(
                "/api/v1/organizations/",
                json={"name": "My Org", "industry": "Textile / Loom"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["name"] == "My Org"

    def test_create_org_already_has_org(self, client):
        """User already in an org should get 400."""
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/organizations/",
                json={"name": "Another Org"},
                headers=auth_header(),
            )
        assert r.status_code == 400
        assert "already belong" in r.json()["detail"]

    def test_create_org_missing_name(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN):
            r = client.post(
                "/api/v1/organizations/",
                json={},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_create_org_name_too_long(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN):
            r = client.post(
                "/api/v1/organizations/",
                json={"name": "A" * 101},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_create_org_no_auth(self, client):
        r = client.post("/api/v1/organizations/", json={"name": "Org"})
        assert r.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# GET / UPDATE ORGANIZATION
# ──────────────────────────────────────────────────────────────────────────────

class TestGetUpdateOrganization:
    def test_get_my_org(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_organization", return_value={"id": ORG_ID, **_org_doc()}):
            r = client.get("/api/v1/organizations/me", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["name"] == "Test Org"

    def test_get_my_org_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_organization", return_value=None):
            r = client.get("/api/v1/organizations/me", headers=auth_header())
        assert r.status_code == 404

    def test_update_org_as_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.update_organization", return_value={"id": ORG_ID, "name": "Updated"}):
            r = client.put(
                "/api/v1/organizations/me",
                json={"name": "Updated"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_update_org_as_supervisor_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.put(
                "/api/v1/organizations/me",
                json={"name": "Hack"},
                headers=auth_header(),
            )
        assert r.status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# MEMBERS
# ──────────────────────────────────────────────────────────────────────────────

class TestMembers:
    def test_list_members(self, client):
        members = [
            {"uid": OWNER_UID, "email": "owner@test.com", "role": "Owner"},
        ]
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.get_org_members", return_value=members):
            r = client.get("/api/v1/organizations/members", headers=auth_header())
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_invite_member_as_owner(self, client):
        firebase_user = MagicMock()
        firebase_user.uid = "new-uid"
        firebase_user.custom_claims = {}

        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("firebase_admin.auth.get_user_by_email", side_effect=Exception("UserNotFoundError")), \
             patch("firebase_admin.auth.UserNotFoundError", Exception), \
             patch("firebase_admin.auth.create_user", return_value=firebase_user), \
             patch("app.main.set_user_claims"), \
             patch("app.main.crud.add_member", return_value={"uid": "new-uid", "role": "Supervisor"}), \
             patch("app.main.send_invite_email", return_value=True), \
             patch("firebase_admin.auth.generate_password_reset_link", return_value="http://reset"):
            r = client.post(
                "/api/v1/organizations/members/invite",
                json={
                    "email": "new@test.com",
                    "name": "New User",
                    "password": "pass123",
                    "role": "Supervisor",
                },
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_invite_member_as_supervisor_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=SUPERVISOR_TOKEN):
            r = client.post(
                "/api/v1/organizations/members/invite",
                json={"email": "x@x.com", "name": "X", "password": "pass123", "role": "Supervisor"},
                headers=auth_header(),
            )
        assert r.status_code == 403

    def test_invite_member_invalid_role(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.post(
                "/api/v1/organizations/members/invite",
                json={"email": "x@x.com", "name": "X", "password": "pass123", "role": "Hacker"},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_update_member_role_as_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.update_member_role", return_value={"uid": "other-uid", "role": "Supervisor"}), \
             patch("app.main.set_user_claims"):
            r = client.put(
                "/api/v1/organizations/members/other-uid",
                json={"role": "Supervisor"},
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_update_own_role_forbidden(self, client):
        """Owner cannot change their own role."""
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.put(
                f"/api/v1/organizations/members/{OWNER_UID}",
                json={"role": "Supervisor"},
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_remove_member_as_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.remove_member", return_value=True), \
             patch("firebase_admin.auth.set_custom_user_claims"):
            r = client.delete(
                "/api/v1/organizations/members/other-uid",
                headers=auth_header(),
            )
        assert r.status_code == 200

    def test_remove_self_forbidden(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.delete(
                f"/api/v1/organizations/members/{OWNER_UID}",
                headers=auth_header(),
            )
        assert r.status_code == 400

    def test_remove_member_not_found(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN), \
             patch("app.main.crud.remove_member", return_value=False):
            r = client.delete(
                "/api/v1/organizations/members/ghost-uid",
                headers=auth_header(),
            )
        assert r.status_code == 404
