"""
Tests: Health check + Authentication endpoints
Covers: /health, /api/v1/auth/login, /api/v1/auth/me, /api/v1/auth/register
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from .conftest import OWNER_TOKEN, OPERATOR_TOKEN, NO_ORG_TOKEN, auth_header


# ──────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["database"] == "firestore"

    def test_health_no_auth_required(self, client):
        """Health endpoint must be publicly accessible."""
        r = client.get("/health")
        assert r.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# AUTH: LOGIN
# ──────────────────────────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"idToken": "firebase-id-token-abc"}

        with patch("app.auth.requests.post", return_value=mock_resp):
            r = client.post(
                "/api/v1/auth/login",
                data={"username": "owner@test.com", "password": "password123"},
            )
        assert r.status_code == 200
        assert r.json()["access_token"] == "firebase-id-token-abc"
        assert r.json()["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"error": {"message": "INVALID_PASSWORD"}}

        with patch("app.auth.requests.post", return_value=mock_resp):
            r = client.post(
                "/api/v1/auth/login",
                data={"username": "owner@test.com", "password": "wrong"},
            )
        assert r.status_code == 400
        assert "Login Failed" in r.json()["detail"]

    def test_login_missing_fields(self, client):
        r = client.post("/api/v1/auth/login", data={})
        assert r.status_code == 422

    def test_login_empty_password(self, client):
        r = client.post(
            "/api/v1/auth/login",
            data={"username": "owner@test.com", "password": ""},
        )
        # Empty password should fail at Firebase level
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"error": {"message": "MISSING_PASSWORD"}}
        with patch("app.auth.requests.post", return_value=mock_resp):
            r = client.post(
                "/api/v1/auth/login",
                data={"username": "owner@test.com", "password": ""},
            )
        assert r.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# AUTH: ME
# ──────────────────────────────────────────────────────────────────────────────

class TestGetMe:
    def test_get_me_owner(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OWNER_TOKEN):
            r = client.get("/api/v1/auth/me", headers=auth_header())
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "owner@test.com"
        assert body["org_role"] == "Owner"

    def test_get_me_operator(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=OPERATOR_TOKEN):
            r = client.get("/api/v1/auth/me", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["org_role"] == "Operator"

    def test_get_me_no_token(self, client):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_get_me_invalid_token(self, client):
        with patch("firebase_admin.auth.verify_id_token", side_effect=Exception("invalid")):
            r = client.get("/api/v1/auth/me", headers=auth_header("bad-token"))
        assert r.status_code == 401

    def test_get_me_super_admin(self, client):
        super_token = {**OWNER_TOKEN, "email": "yugendharanmohan@gmail.com"}
        with patch("firebase_admin.auth.verify_id_token", return_value=super_token):
            r = client.get("/api/v1/auth/me", headers=auth_header())
        assert r.status_code == 200
        assert r.json()["is_super_admin"] is True


# ──────────────────────────────────────────────────────────────────────────────
# AUTH: REGISTER
# ──────────────────────────────────────────────────────────────────────────────

class TestRegister:
    def test_register_success(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN), \
             patch("app.auth.db") as mock_db:
            mock_db.collection.return_value.document.return_value.set = MagicMock()
            r = client.post(
                "/api/v1/auth/register",
                json={"name": "Test User", "role": "Owner"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Test User"
        assert body["role"] == "Owner"  # Always Owner regardless of input

    def test_register_role_always_owner(self, client):
        """Even if client sends Operator, role must be Owner."""
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN), \
             patch("app.auth.db") as mock_db:
            mock_db.collection.return_value.document.return_value.set = MagicMock()
            r = client.post(
                "/api/v1/auth/register",
                json={"name": "Hacker", "role": "Operator"},
                headers=auth_header(),
            )
        assert r.status_code == 200
        assert r.json()["role"] == "Owner"

    def test_register_missing_name(self, client):
        with patch("firebase_admin.auth.verify_id_token", return_value=NO_ORG_TOKEN):
            r = client.post(
                "/api/v1/auth/register",
                json={},
                headers=auth_header(),
            )
        assert r.status_code == 422

    def test_register_no_auth(self, client):
        r = client.post("/api/v1/auth/register", json={"name": "Test"})
        assert r.status_code == 401
