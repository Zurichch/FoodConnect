"""
Unit tests for the explainable matching algorithm (services/matching.py).

These tests do not need the database: we build Donation and NGOProfile
objects in memory and give the algorithm a fixed "now" time, so results are
always the same.
"""
from datetime import datetime, timedelta

from app.models import Donation, NGOProfile
from app.services import matching

NOW = datetime(2026, 10, 15, 10, 0, 0)


def make_donation(**overrides):
    values = dict(
        id=1, food_name="Idli", category="cooked_meals", servings=40, quantity=10, quantity_unit="kg",
        dietary_type="vegetarian", is_packaged=False, storage_type="room_temperature",
        pickup_area="Adyar", pickup_postal_code="600020",
        prepared_at=NOW - timedelta(hours=1), expires_at=NOW + timedelta(hours=8),
        pickup_deadline=NOW + timedelta(hours=5),
    )
    values.update(overrides)
    return Donation(**values)


def make_ngo(**overrides):
    values = dict(
        id=1, organization_name="Helping Hands", service_areas="Adyar,Besant Nagar", postal_codes="600020",
        max_capacity_servings=200, pickup_lead_time_minutes=30, preferred_categories="cooked_meals",
        dietary_preference="any", can_store_refrigerated=False, can_store_frozen=False,
        accepts_unpackaged=True, verification_status="verified",
    )
    values.update(overrides)
    return NGOProfile(**values)


def test_weights_add_up_to_100():
    assert sum(matching.WEIGHTS.values()) == 100


def test_perfect_match_scores_100_with_explanation():
    result = matching.calculate_match_score(make_donation(), make_ngo(), available_capacity=200, now=NOW)
    assert result["eligible"] is True
    assert result["score"] == 100
    assert [c["points"] for c in result["components"]] == [30, 20, 15, 15, 20]
    assert result["explanation"].startswith("Recommended because the NGO serves the pickup area (Adyar)")


def test_score_equals_sum_of_components():
    ngo = make_ngo(service_areas="Guindy", postal_codes="600032", preferred_categories="bakery",
                   dietary_preference="prefers_vegetarian")
    result = matching.calculate_match_score(make_donation(dietary_type="non_vegetarian"), ngo, 60, NOW)
    assert result["score"] == sum(c["points"] for c in result["components"])
    # same postal district (15) + just enough capacity 60/40=1.5 (15) + not preferred (6) + prefers veg (7) + 4.5h spare (20)
    assert result["score"] == 15 + 15 + 6 + 7 + 20


def test_location_scoring_levels():
    assert matching.score_location("adyar ", "600020", ["Adyar"], [])[0] == 30          # area match, case-insensitive
    assert matching.score_location("Unknown", "600020", [], ["600020"])[0] == 30       # exact postal code
    assert matching.score_location("Unknown", "600017", [], ["600020"])[0] == 15       # same postal district
    assert matching.score_location("Unknown", "560001", [], ["600020"])[0] == 0        # different city


def test_capacity_scoring_levels():
    assert matching.score_capacity(40, 100)[0] == 20
    assert matching.score_capacity(40, 50)[0] == 15
    assert matching.score_capacity(40, 40)[0] == 10
    assert matching.score_capacity(40, 39)[0] == 0


def test_deadline_scoring_levels():
    deadline = NOW + timedelta(hours=2)
    assert matching.score_deadline(NOW, NOW + timedelta(hours=5), 30)[0] == 20
    assert matching.score_deadline(NOW, deadline, 30)[0] == 14
    assert matching.score_deadline(NOW, deadline, 100)[0] == 8
    assert matching.score_deadline(NOW, deadline, 130)[0] == 0


def test_unverified_ngo_is_excluded():
    result = matching.calculate_match_score(make_donation(), make_ngo(verification_status="pending"), 200, NOW)
    assert result["eligible"] is False
    assert {"NOT_VERIFIED"} == {r["code"] for r in result["exclusion_reasons"]}


def test_vegetarian_only_ngo_excluded_for_non_vegetarian_food():
    result = matching.calculate_match_score(
        make_donation(dietary_type="non_vegetarian"), make_ngo(dietary_preference="vegetarian_only"), 200, NOW
    )
    assert result["eligible"] is False
    assert "DIETARY" in {r["code"] for r in result["exclusion_reasons"]}


def test_storage_and_packaging_restrictions_exclude():
    fridge = matching.calculate_match_score(make_donation(storage_type="refrigerated"), make_ngo(), 200, NOW)
    assert "STORAGE" in {r["code"] for r in fridge["exclusion_reasons"]}
    unpacked = matching.calculate_match_score(make_donation(), make_ngo(accepts_unpackaged=False), 200, NOW)
    assert "PACKAGING" in {r["code"] for r in unpacked["exclusion_reasons"]}


def test_ngo_without_enough_capacity_is_excluded():
    result = matching.calculate_match_score(make_donation(servings=150), make_ngo(), 100, NOW)
    assert "CAPACITY" in {r["code"] for r in result["exclusion_reasons"]}


def test_ngo_that_cannot_arrive_before_deadline_is_excluded():
    donation = make_donation(pickup_deadline=NOW + timedelta(minutes=40))
    result = matching.calculate_match_score(donation, make_ngo(pickup_lead_time_minutes=60), 200, NOW)
    assert "DEADLINE" in {r["code"] for r in result["exclusion_reasons"]}


def test_ranking_is_sorted_and_deterministic():
    donation = make_donation()
    ngos = [
        make_ngo(id=1, organization_name="Far Away", service_areas="Guindy", postal_codes="600032"),
        make_ngo(id=2, organization_name="Local Kitchen"),
        make_ngo(id=3, organization_name="Veg Only", dietary_preference="vegan_only"),
        make_ngo(id=4, organization_name="Pending NGO", verification_status="pending"),
    ]
    first = matching.rank_ngos_for_donation(donation, ngos, NOW, capacity_lookup=lambda ngo: 200)
    second = matching.rank_ngos_for_donation(donation, ngos, NOW, capacity_lookup=lambda ngo: 200)
    names = [e["ngo"]["organization_name"] for e in first["recommendations"]]
    assert names == ["Local Kitchen", "Far Away"]
    assert [e["rank"] for e in first["recommendations"]] == [1, 2]
    assert {e["ngo"]["organization_name"] for e in first["excluded"]} == {"Veg Only", "Pending NGO"}
    assert first == second  # same inputs -> same output


def test_ties_are_broken_by_spare_capacity_then_name():
    donation = make_donation()
    ngos = [make_ngo(id=1, organization_name="B Kitchen"), make_ngo(id=2, organization_name="A Kitchen")]
    capacities = {1: 300, 2: 200}
    result = matching.rank_ngos_for_donation(donation, ngos, NOW, capacity_lookup=lambda ngo: capacities[ngo.id])
    assert [e["ngo"]["organization_name"] for e in result["recommendations"]] == ["B Kitchen", "A Kitchen"]
