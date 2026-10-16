"""Tests for the food safety and expiry rules (services/food_safety.py) and the API that uses them."""
from datetime import datetime, timedelta

from app.services.food_safety import check_food_safety
from tests.conftest import auth_header, donation_payload, register_donor

NOW = datetime(2026, 10, 15, 10, 0, 0)


def details(**overrides):
    values = dict(
        prepared_at=NOW - timedelta(hours=1), expires_at=NOW + timedelta(hours=6),
        pickup_deadline=NOW + timedelta(hours=4), storage_type="room_temperature",
        category="cooked_meals", is_packaged=True, allergens="none", safety_declaration=True,
    )
    values.update(overrides)
    return values


def test_valid_donation_is_publishable():
    result = check_food_safety(details(), NOW)
    assert result["is_publishable"] is True
    assert result["errors"] == {}


def test_expired_food_is_blocked():
    result = check_food_safety(details(expires_at=NOW - timedelta(minutes=1), pickup_deadline=NOW - timedelta(hours=1)), NOW)
    assert result["is_publishable"] is False
    assert "expires_at" in result["errors"]


def test_pickup_deadline_after_expiry_is_blocked():
    result = check_food_safety(details(pickup_deadline=NOW + timedelta(hours=7)), NOW)
    assert "pickup_deadline" in result["errors"]


def test_pickup_deadline_too_soon_is_blocked():
    result = check_food_safety(details(pickup_deadline=NOW + timedelta(minutes=10)), NOW)
    assert "pickup_deadline" in result["errors"]


def test_preparation_in_future_is_blocked():
    result = check_food_safety(details(prepared_at=NOW + timedelta(hours=1)), NOW)
    assert "prepared_at" in result["errors"]


def test_missing_safety_declaration_is_blocked():
    result = check_food_safety(details(safety_declaration=False), NOW)
    assert "safety_declaration" in result["errors"]


def test_long_room_temperature_holding_gives_warning_not_error():
    result = check_food_safety(details(expires_at=NOW + timedelta(hours=10)), NOW)
    assert result["is_publishable"] is True
    assert any("double-check" in w for w in result["warnings"])


def test_urgent_expiry_warning():
    result = check_food_safety(details(expires_at=NOW + timedelta(hours=1.5), pickup_deadline=NOW + timedelta(hours=1)), NOW)
    assert any(w.startswith("Urgent") for w in result["warnings"])


def test_api_rejects_expired_donation(client):
    token = register_donor(client)
    payload = donation_payload(
        prepared_at="2020-01-01T08:00:00Z", expires_at="2020-01-01T12:00:00Z", pickup_deadline="2020-01-01T11:00:00Z"
    )
    response = client.post("/api/donations", json=payload, headers=auth_header(token))
    assert response.status_code == 422
    body = response.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == "SAFETY_CHECK_FAILED"
    assert "expires_at" in body["error"]["details"]
