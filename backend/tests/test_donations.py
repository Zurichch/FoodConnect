"""Tests for donation creation, validation, ownership, matching API, requests, claims and status transitions."""
from app.extensions import db
from app.models import Donation, Notification, User
from app.services.lifecycle import can_transition
from tests.conftest import auth_header, create_admin, create_donation, login, ngo_profile_by_email, register_donor, register_ngo


# ------------------------------------------------------------------ creation & validation
def test_donor_creates_donation_and_it_is_saved(client):
    token = register_donor(client)
    donation = create_donation(client, token)
    assert donation["status"] == "AVAILABLE"
    saved = db.session.get(Donation, donation["id"])
    assert saved is not None and saved.food_name == "Veg biryani"
    assert saved.status_history[0].new_status == "AVAILABLE"


def test_donor_id_comes_from_token_not_body(client):
    token = register_donor(client, email="a@test.com")
    register_donor(client, email="b@test.com")
    other = User.query.filter_by(email="b@test.com").first()
    donation = create_donation(client, token, donor_id=other.id)
    assert donation["donor_id"] != other.id


def test_missing_fields_return_validation_errors(client):
    token = register_donor(client)
    response = client.post("/api/donations", json={"food_name": ""}, headers=auth_header(token))
    assert response.status_code == 400
    details = response.get_json()["error"]["details"]
    for field in ("food_name", "category", "servings", "pickup_deadline", "pickup_area"):
        assert field in details


def test_invalid_values_are_rejected(client):
    token = register_donor(client)
    payload = {"servings": -5, "category": "pizza-party", "prepared_at": "not-a-date"}
    from tests.conftest import donation_payload
    response = client.post("/api/donations", json=donation_payload(**payload), headers=auth_header(token))
    details = response.get_json()["error"]["details"]
    assert response.status_code == 400
    assert {"servings", "category", "prepared_at"} <= set(details)


def test_donor_cannot_cancel_someone_elses_donation(client):
    owner = register_donor(client, email="owner@test.com")
    intruder = register_donor(client, email="intruder@test.com")
    donation = create_donation(client, owner)
    response = client.post(f"/api/donations/{donation['id']}/cancel", json={}, headers=auth_header(intruder))
    assert response.status_code == 403


def test_matches_endpoint_returns_backend_scores(client):
    donor = register_donor(client)
    register_ngo(client, email="good@test.com", name="Good NGO")
    register_ngo(client, email="veg@test.com", name="Veg NGO", dietary_preference="vegan_only")
    donation = create_donation(client, donor)
    data = client.get(f"/api/donations/{donation['id']}/matches", headers=auth_header(donor)).get_json()["data"]
    assert [m["ngo"]["organization_name"] for m in data["recommendations"]] == ["Good NGO"]
    top = data["recommendations"][0]
    assert top["score"] == sum(c["points"] for c in top["components"])
    assert data["excluded"][0]["ngo"]["organization_name"] == "Veg NGO"


# ------------------------------------------------------------------ requests & claims
def setup_two_ngo_requests(client):
    donor = register_donor(client)
    ngo_a = register_ngo(client, email="a@ngo.com", name="NGO A")
    ngo_b = register_ngo(client, email="b@ngo.com", name="NGO B")
    donation = create_donation(client, donor)
    req_a = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo_a))
    req_b = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo_b))
    assert req_a.status_code == 201 and req_b.status_code == 201
    return donor, ngo_a, ngo_b, donation, req_a.get_json()["data"], req_b.get_json()["data"]


def test_ngo_request_moves_donation_to_requested_and_notifies_donor(client):
    donor, _, _, donation, _, _ = setup_two_ngo_requests(client)
    saved = db.session.get(Donation, donation["id"])
    assert saved.status == "REQUESTED"
    assert Notification.query.filter_by(user_id=saved.donor_id, notification_type="request_received").count() == 2


def test_same_ngo_cannot_request_twice(client):
    donor = register_donor(client)
    ngo = register_ngo(client)
    donation = create_donation(client, donor)
    client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo))
    again = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo))
    assert again.status_code == 409


def test_unverified_ngo_cannot_request(client):
    donor = register_donor(client)
    ngo = register_ngo(client, verified=False)
    donation = create_donation(client, donor)
    response = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo))
    assert response.status_code == 403


def test_two_ngos_cannot_both_claim_the_same_donation(client):
    donor, _, _, donation, req_a, req_b = setup_two_ngo_requests(client)
    first = client.post(f"/api/requests/{req_a['id']}/accept", json={}, headers=auth_header(donor))
    assert first.status_code == 200
    second = client.post(f"/api/requests/{req_b['id']}/accept", json={}, headers=auth_header(donor))
    assert second.status_code == 409  # B was auto-rejected and the donation is already claimed
    saved = db.session.get(Donation, donation["id"])
    assert saved.status == "ACCEPTED"
    assert saved.assigned_ngo.organization_name == "NGO A"


def test_atomic_claim_blocks_second_accept_even_if_request_still_pending(client):
    """Simulates a race: both requests are still 'pending' when the second accept arrives."""
    from app.models import CollectionRequest
    from app.services.collection_service import accept_collection_request
    from app.utils.responses import ApiError

    donor, _, _, donation, req_a, req_b = setup_two_ngo_requests(client)
    donor_user = User.query.filter_by(role="donor").first()
    request_a = db.session.get(CollectionRequest, req_a["id"])
    request_b = db.session.get(CollectionRequest, req_b["id"])
    accept_collection_request(request_a, donor_user)
    request_b.status = "pending"  # pretend the second request has not been closed yet
    db.session.commit()
    try:
        accept_collection_request(request_b, donor_user)
        raised = False
    except ApiError as error:
        raised = error.code == "ALREADY_CLAIMED"
    assert raised


def test_accepted_donation_is_hidden_from_other_ngos(client):
    donor, _, ngo_b, donation, req_a, _ = setup_two_ngo_requests(client)
    client.post(f"/api/requests/{req_a['id']}/accept", json={}, headers=auth_header(donor))
    available = client.get("/api/donations/available", headers=auth_header(ngo_b)).get_json()["data"]["items"]
    assert donation["id"] not in [d["id"] for d in available]


def test_ngo_cannot_accept_its_own_request(client):
    _, ngo_a, _, _, req_a, _ = setup_two_ngo_requests(client)
    response = client.post(f"/api/requests/{req_a['id']}/accept", json={}, headers=auth_header(ngo_a))
    assert response.status_code == 403


def test_donor_offer_then_ngo_accepts(client):
    donor = register_donor(client)
    ngo_token = register_ngo(client, email="offer@ngo.com", name="Offer NGO")
    donation = create_donation(client, donor)
    ngo = ngo_profile_by_email("offer@ngo.com")
    offer = client.post(f"/api/donations/{donation['id']}/offer", json={"ngo_id": ngo.id}, headers=auth_header(donor))
    assert offer.status_code == 201
    incoming = client.get("/api/requests/incoming", headers=auth_header(ngo_token)).get_json()["data"]["items"]
    assert len(incoming) == 1
    accepted = client.post(f"/api/requests/{incoming[0]['id']}/accept", json={}, headers=auth_header(ngo_token))
    assert accepted.status_code == 200
    assert db.session.get(Donation, donation["id"]).status == "ACCEPTED"


def test_rejecting_last_request_reopens_donation(client):
    donor = register_donor(client)
    ngo = register_ngo(client)
    donation = create_donation(client, donor)
    req = client.post(f"/api/donations/{donation['id']}/requests", json={}, headers=auth_header(ngo)).get_json()["data"]
    client.post(f"/api/requests/{req['id']}/reject", json={"note": "Too far"}, headers=auth_header(donor))
    assert db.session.get(Donation, donation["id"]).status == "AVAILABLE"


# ------------------------------------------------------------------ lifecycle
def test_transition_table():
    assert can_transition("AVAILABLE", "REQUESTED")
    assert can_transition("COLLECTED", "DELIVERED")
    assert not can_transition("AVAILABLE", "DELIVERED")
    assert not can_transition("DELIVERED", "AVAILABLE")
    assert not can_transition("CANCELLED", "ACCEPTED")


def test_full_lifecycle_and_invalid_jumps(client):
    donor, ngo_a, ngo_b, donation, req_a, _ = setup_two_ngo_requests(client)
    client.post(f"/api/requests/{req_a['id']}/accept", json={}, headers=auth_header(donor))
    url = f"/api/donations/{donation['id']}/status"

    # Skipping a step is refused
    jump = client.post(url, json={"status": "DELIVERED"}, headers=auth_header(ngo_a))
    assert jump.status_code == 409
    # Another NGO cannot update it
    assert client.post(url, json={"status": "COLLECTED"}, headers=auth_header(ngo_b)).status_code == 403
    # Donor cannot use the NGO status endpoint
    assert client.post(url, json={"status": "COLLECTED"}, headers=auth_header(donor)).status_code == 403

    deadline = db.session.get(Donation, donation["id"]).pickup_deadline
    scheduled = deadline.strftime("%Y-%m-%dT%H:%M:%SZ")
    assert client.post(url, json={"status": "PICKUP_SCHEDULED", "scheduled_pickup_at": scheduled}, headers=auth_header(ngo_a)).status_code == 200
    assert client.post(url, json={"status": "COLLECTED"}, headers=auth_header(ngo_a)).status_code == 200
    assert client.post(url, json={"status": "DELIVERED", "servings_distributed": 38}, headers=auth_header(ngo_a)).status_code == 200

    details = client.get(f"/api/donations/{donation['id']}", headers=auth_header(donor)).get_json()["data"]
    statuses = [h["new_status"] for h in details["history"]]
    assert statuses == ["AVAILABLE", "REQUESTED", "ACCEPTED", "PICKUP_SCHEDULED", "COLLECTED", "DELIVERED"]
    assert details["donation"]["servings_distributed"] == 38
    # Delivered donations cannot be cancelled
    assert client.post(f"/api/donations/{donation['id']}/cancel", json={}, headers=auth_header(donor)).status_code == 409


def test_overdue_donation_expires_automatically(client):
    from datetime import timedelta

    donor = register_donor(client)
    donation = create_donation(client, donor)
    saved = db.session.get(Donation, donation["id"])
    saved.pickup_deadline = saved.pickup_deadline - timedelta(hours=10)  # pretend time has passed
    db.session.commit()
    data = client.get(f"/api/donations/{donation['id']}", headers=auth_header(donor)).get_json()["data"]
    assert data["donation"]["status"] == "EXPIRED"


def test_analytics_reflect_database(client):
    donor = register_donor(client)
    create_donation(client, donor)
    create_admin()
    admin_token = login(client, "admin@test.com").get_json()["data"]["token"]
    summary = client.get("/api/analytics/admin", headers=auth_header(admin_token)).get_json()["data"]["summary"]
    assert summary["total_donations"] == 1
    assert summary["available_donations"] == 1
    public = client.get("/api/public/stats").get_json()["data"]
    assert public["total_donations"] == 1
