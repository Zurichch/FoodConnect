"""Tests for the donations map: location lookup, pin validation, privacy and access rules."""
from sqlalchemy import create_engine, text

from app.extensions import db
from app.models import Donation
from app.services import geo
from tests.conftest import auth_header, create_admin, create_donation, donation_payload, login, register_donor, register_ngo

EXACT_PIN = {"pickup_latitude": 13.0063, "pickup_longitude": 80.2574}


def test_area_lookup_is_case_insensitive_and_falls_back_to_pin_code():
    assert geo.area_center("  ADYAR ") == geo.AREA_COORDINATES["adyar"]
    assert geo.area_center("Unknown place", "600042") == geo.AREA_COORDINATES["velachery"]
    assert geo.area_center("Unknown place", "999999") is None


def test_spread_is_deterministic_and_stays_close():
    first = geo.spread(13.0, 80.2, 7)
    assert first == geo.spread(13.0, 80.2, 7)
    assert abs(first[0] - 13.0) < 0.01 and abs(first[1] - 80.2) < 0.01


def test_donation_saves_optional_map_pin(client):
    token = register_donor(client)
    donation = create_donation(client, token, **EXACT_PIN)
    saved = db.session.get(Donation, donation["id"])
    assert (saved.pickup_latitude, saved.pickup_longitude) == (13.0063, 80.2574)


def test_invalid_or_half_map_pin_is_rejected(client):
    token = register_donor(client)
    bad = client.post("/api/donations", json=donation_payload(pickup_latitude=200, pickup_longitude=80.2), headers=auth_header(token))
    assert bad.status_code == 400 and "pickup_latitude" in bad.get_json()["error"]["details"]
    half = client.post("/api/donations", json=donation_payload(pickup_latitude=13.0), headers=auth_header(token))
    assert half.status_code == 400


def test_ngo_sees_only_approximate_location_until_assigned(client):
    donor = register_donor(client)
    ngo = register_ngo(client)
    donation = create_donation(client, donor, **EXACT_PIN)

    markers = client.get("/api/donations/map", headers=auth_header(ngo)).get_json()["data"]["markers"]
    marker = next(m for m in markers if m["donation_id"] == donation["id"])
    assert marker["precision"] == "approximate"
    assert (marker["lat"], marker["lng"]) != (13.0063, 80.2574)

    details = client.get(f"/api/donations/{donation['id']}", headers=auth_header(ngo)).get_json()["data"]
    assert details["map_location"]["precision"] == "approximate"
    assert "pickup_latitude" not in details["donation"]

    # After the donor accepts this NGO, it gets the exact pin.
    request = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo)).get_json()["data"]
    client.post(f"/api/requests/{request['id']}/accept", json={}, headers=auth_header(donor))
    details = client.get(f"/api/donations/{donation['id']}", headers=auth_header(ngo)).get_json()["data"]
    assert details["map_location"] == {"lat": 13.0063, "lng": 80.2574, "precision": "exact"}
    mine = client.get("/api/donations/map", headers=auth_header(ngo)).get_json()["data"]["markers"]
    assert next(m for m in mine if m["donation_id"] == donation["id"])["is_mine"] is True


def test_owner_and_admin_see_exact_location(client):
    donor = register_donor(client)
    donation = create_donation(client, donor, **EXACT_PIN)
    details = client.get(f"/api/donations/{donation['id']}", headers=auth_header(donor)).get_json()["data"]
    assert details["map_location"]["precision"] == "exact"

    create_admin()
    admin = login(client, "admin@test.com").get_json()["data"]["token"]
    markers = client.get("/api/donations/map", headers=auth_header(admin)).get_json()["data"]["markers"]
    assert markers[0]["precision"] == "exact"


def test_unknown_area_without_pin_is_counted_as_unmapped(client):
    donor = register_donor(client)
    ngo = register_ngo(client)
    create_donation(client, donor, pickup_area="Nowhere", pickup_postal_code="999999")
    data = client.get("/api/donations/map", headers=auth_header(ngo)).get_json()["data"]
    assert data["markers"] == [] and data["unmapped_count"] == 1


def test_donor_cannot_open_the_map_endpoint(client):
    donor = register_donor(client)
    assert client.get("/api/donations/map", headers=auth_header(donor)).status_code == 403


def test_old_database_gets_new_columns_added(tmp_path):
    from app.utils.db_upgrade import add_missing_columns

    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE donations (id INTEGER PRIMARY KEY, food_name TEXT)"))

    class FakeDb:  # add_missing_columns only needs .engine
        pass

    fake = FakeDb()
    fake.engine = engine
    assert add_missing_columns(fake) == ["donations.pickup_latitude", "donations.pickup_longitude"]
    assert add_missing_columns(fake) == []  # running again changes nothing
