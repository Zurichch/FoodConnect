"""
conftest.py - Shared test setup (pytest loads this file automatically).

Every test gets a brand-new in-memory database, so tests never affect each
other or your real demo database.
"""
import os
import sys
from datetime import timedelta

import pytest

# Make "import app" work when pytest is started from the backend folder.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import NGOProfile, User  # noqa: E402
from app.utils.time_utils import to_iso, utc_now  # noqa: E402
from config import TestConfig  # noqa: E402

PASSWORD = "TestPass123"


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


# ------------------------------------------------------------------ helpers
def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def register_donor(client, email="donor@test.com", area="Adyar", postal_code="600020"):
    response = client.post("/api/auth/register", json={
        "name": "Test Donor", "email": email, "password": PASSWORD, "role": "donor",
        "phone": "9999999999", "area": area, "postal_code": postal_code, "donor_type": "restaurant",
    })
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]["token"]


def register_ngo(client, email="ngo@test.com", name="Test NGO", verified=True, **profile):
    body = {
        "name": "NGO Rep", "email": email, "password": PASSWORD, "role": "ngo",
        "phone": "8888888888", "area": "Adyar", "postal_code": "600020",
        "organization_name": name, "service_areas": ["Adyar", "Besant Nagar"], "postal_codes": ["600020"],
        "max_capacity_servings": 200, "pickup_lead_time_minutes": 30, "dietary_preference": "any",
        "accepts_unpackaged": True,
    }
    body.update(profile)
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 201, response.get_json()
    if verified:
        user = User.query.filter_by(email=email).first()
        user.ngo_profile.verification_status = "verified"
        db.session.commit()
    return response.get_json()["data"]["token"]


def create_admin(email="admin@test.com"):
    admin = User(name="Admin", email=email, role="admin")
    admin.set_password(PASSWORD)
    db.session.add(admin)
    db.session.commit()
    return admin


def login(client, email, password=PASSWORD):
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    return response


def donation_payload(**overrides):
    """A valid donation that passes all safety checks."""
    now = utc_now()
    body = {
        "food_name": "Veg biryani", "category": "cooked_meals", "quantity": 10, "quantity_unit": "kg",
        "servings": 40, "dietary_type": "vegetarian", "is_packaged": False, "storage_type": "room_temperature",
        "allergens": "nuts",
        "prepared_at": to_iso(now - timedelta(hours=1)),
        "expires_at": to_iso(now + timedelta(hours=6)),
        "pickup_deadline": to_iso(now + timedelta(hours=4)),
        "pickup_address": "12 LB Road", "pickup_area": "Adyar", "pickup_postal_code": "600020",
        "safety_declaration": True,
    }
    body.update(overrides)
    return body


def create_donation(client, token, **overrides):
    response = client.post("/api/donations", json=donation_payload(**overrides), headers=auth_header(token))
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]["donation"]


def ngo_profile_by_email(email):
    return NGOProfile.query.join(User).filter(User.email == email).first()
