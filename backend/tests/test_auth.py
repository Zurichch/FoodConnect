"""Tests for registration, login, logout and role-based authorization."""
from app.models import User
from tests.conftest import PASSWORD, auth_header, create_admin, login, register_donor, register_ngo


def test_register_and_login_donor(client):
    register_donor(client, email="new@test.com")
    response = login(client, "NEW@test.com")  # email is case-insensitive
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["user"]["role"] == "donor"
    assert "password_hash" not in data["user"]
    assert data["token"]


def test_password_is_hashed(client, app):
    register_donor(client, email="hash@test.com")
    user = User.query.filter_by(email="hash@test.com").first()
    assert user.password_hash != PASSWORD
    assert user.check_password(PASSWORD)


def test_duplicate_registration_is_rejected(client):
    register_donor(client, email="dup@test.com")
    response = client.post("/api/auth/register", json={
        "name": "X", "email": "dup@test.com", "password": PASSWORD, "role": "donor",
        "phone": "1", "area": "A", "postal_code": "600001",
    })
    assert response.status_code == 400
    assert "email" in response.get_json()["error"]["details"]


def test_cannot_self_register_as_admin(client):
    response = client.post("/api/auth/register", json={
        "name": "X", "email": "evil@test.com", "password": PASSWORD, "role": "admin",
        "phone": "1", "area": "A", "postal_code": "600001",
    })
    assert response.status_code == 400
    assert "role" in response.get_json()["error"]["details"]


def test_weak_password_and_bad_email_rejected(client):
    response = client.post("/api/auth/register", json={
        "name": "X", "email": "not-an-email", "password": "short", "role": "donor",
        "phone": "1", "area": "A", "postal_code": "600001",
    })
    details = response.get_json()["error"]["details"]
    assert response.status_code == 400
    assert "email" in details and "password" in details


def test_wrong_password_rejected(client):
    register_donor(client, email="wp@test.com")
    response = login(client, "wp@test.com", "WrongPass999")
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_ngo_registration_starts_pending(client):
    token = register_ngo(client, verified=False)
    response = client.get("/api/ngo/profile", headers=auth_header(token))
    assert response.get_json()["data"]["verification_status"] == "pending"


def test_protected_route_requires_token(client):
    assert client.get("/api/donations/mine").status_code == 401


def test_logout_revokes_token(client):
    token = register_donor(client)
    assert client.post("/api/auth/logout", headers=auth_header(token)).status_code == 200
    response = client.get("/api/auth/me", headers=auth_header(token))
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "TOKEN_REVOKED"


def test_donor_cannot_access_admin_endpoints(client):
    token = register_donor(client)
    for url in ("/api/admin/users", "/api/admin/dashboard", "/api/analytics/admin", "/api/admin/audit-logs"):
        response = client.get(url, headers=auth_header(token))
        assert response.status_code == 403, url


def test_ngo_cannot_create_donation_and_donor_cannot_browse_ngo_list(client):
    ngo_token = register_ngo(client)
    donor_token = register_donor(client)
    assert client.post("/api/donations", json={}, headers=auth_header(ngo_token)).status_code == 403
    assert client.get("/api/donations/available", headers=auth_header(donor_token)).status_code == 403


def test_admin_can_access_admin_endpoints(client):
    create_admin()
    token = login(client, "admin@test.com").get_json()["data"]["token"]
    assert client.get("/api/admin/users", headers=auth_header(token)).status_code == 200


def test_suspended_user_is_blocked_immediately(client, app):
    create_admin()
    admin_token = login(client, "admin@test.com").get_json()["data"]["token"]
    donor_token = register_donor(client, email="bad@test.com")
    donor = User.query.filter_by(email="bad@test.com").first()

    response = client.post(f"/api/admin/users/{donor.id}/suspend", json={"reason": "Spam"}, headers=auth_header(admin_token))
    assert response.status_code == 200
    # The old token no longer works because the backend re-checks the database.
    assert client.get("/api/donations/mine", headers=auth_header(donor_token)).status_code == 403
    assert login(client, "bad@test.com").status_code == 403
    logs = client.get("/api/admin/audit-logs", headers=auth_header(admin_token)).get_json()["data"]["items"]
    assert logs[0]["action"] == "USER_SUSPENDED"
