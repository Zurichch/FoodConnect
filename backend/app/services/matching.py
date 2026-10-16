"""
matching.py - FoodConnect's explainable "intelligent matching" algorithm.

GOAL: for a donation, rank the NGOs that are best suited to collect it,
and explain WHY in plain English. The score is fully deterministic: the same
inputs always give the same score. Nothing here is random.

HOW IT WORKS (two stages)

  Stage 1 - Hard filters (an NGO is EXCLUDED if any of these fail):
      * NGO is not verified, or its account is suspended
      * NGO's declared diet rule forbids this food (e.g. vegetarian-only NGO, chicken biryani)
      * NGO cannot handle the storage type (refrigerated / frozen) or unpackaged food
      * Donation servings exceed the NGO's REMAINING capacity
      * NGO cannot reach the donor before the pickup deadline
      * Donation is outside the NGO's service area / postal district

  Stage 2 - Weighted score out of 100 for the NGOs that passed:
      Location compatibility ........ 30 points
      Capacity compatibility ........ 20 points
      Food category preference ...... 15 points
      Dietary compatibility ......... 15 points
      Pickup deadline feasibility ... 20 points
                                      ---
                                      100

Location is AREA-BASED (area names and postal codes), not a GPS distance,
because donors type an address and we do not use a paid maps API.

Food-safety checks (services/food_safety.py) run BEFORE matching, so a high
score can never push an unsafe or expired donation through.

To plug in a machine-learning model later, replace `calculate_match_score`
with a function that returns the same dictionary shape.
"""
from datetime import timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import Donation
from ..utils.constants import STATUS_ACCEPTED, STATUS_COLLECTED, STATUS_PICKUP_SCHEDULED
from ..utils.time_utils import hours_between

WEIGHTS = {
    "location": 30,
    "capacity": 20,
    "category": 15,
    "dietary": 15,
    "deadline": 20,
}

LOCATION_BASIS = (
    "Area-based matching: compares the pickup area and postal code with the NGO's "
    "service areas and postal codes. This is not a GPS distance."
)

# Donations an NGO has accepted but not yet delivered use up its capacity.
CAPACITY_USING_STATUSES = [STATUS_ACCEPTED, STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED]


# ----------------------------------------------------------------------------
# Small helpers
# ----------------------------------------------------------------------------
def normalize_text(text):
    """'  Besant   Nagar ' -> 'besant nagar' so spelling/case differences do not matter."""
    return " ".join(str(text or "").lower().split())


def pretty(value):
    """'non_vegetarian' -> 'non vegetarian' for readable explanations."""
    return str(value or "").replace("_", " ")


def get_available_capacity(ngo):
    """
    Remaining capacity = max capacity - servings the NGO has already committed to
    (accepted, pickup scheduled or collected but not yet delivered).
    """
    committed = (
        db.session.query(func.coalesce(func.sum(Donation.servings), 0))
        .filter(Donation.assigned_ngo_id == ngo.id, Donation.status.in_(CAPACITY_USING_STATUSES))
        .scalar()
    )
    return max(ngo.max_capacity_servings - int(committed), 0)


# ----------------------------------------------------------------------------
# Stage 2: one function per score component. Each returns (points, reason).
# ----------------------------------------------------------------------------
def score_location(pickup_area, pickup_postal_code, ngo_areas, ngo_postal_codes):
    area = normalize_text(pickup_area)
    postal = str(pickup_postal_code or "").strip()
    normalized_ngo_areas = [normalize_text(a) for a in ngo_areas]
    ngo_postals = [str(p).strip() for p in ngo_postal_codes]

    if area and area in normalized_ngo_areas:
        return WEIGHTS["location"], f"serves the pickup area ({pickup_area})"
    if postal and postal in ngo_postals:
        return WEIGHTS["location"], f"serves the pickup postal code ({postal})"
    # Indian PIN codes: the first 3 digits identify the sorting district (roughly the city),
    # e.g. every Chennai code starts with "600". Same district = reachable, but not "local".
    if postal and len(postal) >= 3 and any(p[:3] == postal[:3] for p in ngo_postals if len(p) >= 3):
        return 15, f"operates in the same postal district (codes starting {postal[:3]}) but not this exact area"
    return 0, "does not serve this area or postal district"


def score_capacity(servings, available_capacity):
    if available_capacity < servings:
        return 0, f"has only {available_capacity} servings of capacity left for {servings} needed"
    ratio = available_capacity / servings
    if ratio >= 2:
        return WEIGHTS["capacity"], f"has plenty of spare capacity ({available_capacity} servings free for {servings} needed)"
    if ratio >= 1.25:
        return 15, f"has enough capacity ({available_capacity} servings free for {servings} needed)"
    return 10, f"has just enough capacity ({available_capacity} servings free for {servings} needed)"


def score_category(category, preferred_categories):
    if not preferred_categories:
        return WEIGHTS["category"], "accepts all food categories"
    if category in preferred_categories:
        return WEIGHTS["category"], f"prefers {pretty(category)}"
    return 6, f"accepts {pretty(category)}, although it is not one of its preferred categories"


def score_dietary(dietary_type, ngo_dietary_preference):
    plant_based = dietary_type in ("vegetarian", "vegan")
    if ngo_dietary_preference == "any":
        return WEIGHTS["dietary"], f"accepts {pretty(dietary_type)} food"
    if ngo_dietary_preference == "vegetarian_only" and plant_based:
        return WEIGHTS["dietary"], f"needs vegetarian food and this is {pretty(dietary_type)}"
    if ngo_dietary_preference == "vegan_only" and dietary_type == "vegan":
        return WEIGHTS["dietary"], "needs vegan food and this is vegan"
    if ngo_dietary_preference == "prefers_vegetarian":
        if plant_based:
            return WEIGHTS["dietary"], f"prefers vegetarian food and this is {pretty(dietary_type)}"
        return 7, "prefers vegetarian food but can accept non-vegetarian"
    return 0, f"cannot accept {pretty(dietary_type)} food"


def score_deadline(now, pickup_deadline, pickup_lead_time_minutes):
    earliest_arrival = now + timedelta(minutes=pickup_lead_time_minutes)
    spare_hours = hours_between(earliest_arrival, pickup_deadline)
    if spare_hours < 0:
        return 0, "cannot reach the pickup point before the deadline"
    if spare_hours >= 3:
        return WEIGHTS["deadline"], f"can collect comfortably before the deadline ({spare_hours:.1f} h to spare)"
    if spare_hours >= 1:
        return 14, f"can collect before the deadline ({spare_hours:.1f} h to spare)"
    return 8, f"can collect just before the deadline ({spare_hours * 60:.0f} min to spare)"


# ----------------------------------------------------------------------------
# Stage 1: hard filters
# ----------------------------------------------------------------------------
def find_exclusion_reasons(donation, ngo, available_capacity, now):
    """Returns a list of {"code", "reason"}. An empty list means the NGO is eligible."""
    reasons = []

    def exclude(code, reason):
        reasons.append({"code": code, "reason": reason})

    if not ngo.is_verified:
        exclude("NOT_VERIFIED", "NGO is not verified by an administrator yet")
    if ngo.user is not None and ngo.user.is_suspended:
        exclude("SUSPENDED", "NGO account is suspended")

    dietary_points, dietary_reason = score_dietary(donation.dietary_type, ngo.dietary_preference)
    if dietary_points == 0:
        exclude("DIETARY", f"NGO {dietary_reason}")

    if donation.storage_type == "refrigerated" and not ngo.can_store_refrigerated:
        exclude("STORAGE", "NGO cannot keep food refrigerated")
    if donation.storage_type == "frozen" and not ngo.can_store_frozen:
        exclude("STORAGE", "NGO cannot keep food frozen")
    if not donation.is_packaged and not ngo.accepts_unpackaged:
        exclude("PACKAGING", "NGO does not accept unpackaged food")

    if available_capacity < donation.servings:
        exclude("CAPACITY", f"only {available_capacity} servings of capacity left, donation has {donation.servings}")

    deadline_points, _ = score_deadline(now, donation.pickup_deadline, ngo.pickup_lead_time_minutes)
    if deadline_points == 0:
        exclude("DEADLINE", f"needs {ngo.pickup_lead_time_minutes} minutes to reach the donor - too late for the deadline")

    location_points, _ = score_location(
        donation.pickup_area, donation.pickup_postal_code, ngo.service_area_list(), ngo.postal_code_list()
    )
    if location_points == 0:
        exclude("LOCATION", "pickup location is outside the NGO's service area")

    return reasons


# ----------------------------------------------------------------------------
# Putting it together
# ----------------------------------------------------------------------------
def calculate_match_score(donation, ngo, available_capacity, now):
    """
    Score ONE NGO for ONE donation.

    Returns a dictionary like:
    {
      "eligible": True,
      "score": 87,
      "components": [{"key": "location", "label": ..., "points": 30, "max_points": 30, "reason": ...}, ...],
      "explanation": "Recommended because the NGO serves the pickup area (Adyar), ...",
      "exclusion_reasons": []
    }
    """
    exclusion_reasons = find_exclusion_reasons(donation, ngo, available_capacity, now)

    location = score_location(
        donation.pickup_area, donation.pickup_postal_code, ngo.service_area_list(), ngo.postal_code_list()
    )
    capacity = score_capacity(donation.servings, available_capacity)
    category = score_category(donation.category, ngo.preferred_category_list())
    dietary = score_dietary(donation.dietary_type, ngo.dietary_preference)
    deadline = score_deadline(now, donation.pickup_deadline, ngo.pickup_lead_time_minutes)

    components = [
        {"key": "location", "label": "Location / service area", "points": location[0], "max_points": WEIGHTS["location"], "reason": location[1]},
        {"key": "capacity", "label": "Collection capacity", "points": capacity[0], "max_points": WEIGHTS["capacity"], "reason": capacity[1]},
        {"key": "category", "label": "Food category preference", "points": category[0], "max_points": WEIGHTS["category"], "reason": category[1]},
        {"key": "dietary", "label": "Dietary compatibility", "points": dietary[0], "max_points": WEIGHTS["dietary"], "reason": dietary[1]},
        {"key": "deadline", "label": "Pickup deadline feasibility", "points": deadline[0], "max_points": WEIGHTS["deadline"], "reason": deadline[1]},
    ]
    total_score = sum(component["points"] for component in components)

    if exclusion_reasons:
        explanation = "Not recommended: " + "; ".join(r["reason"] for r in exclusion_reasons) + "."
    else:
        reason_phrases = [component["reason"] for component in components]
        explanation = "Recommended because the NGO " + join_phrases(reason_phrases) + "."

    return {
        "eligible": not exclusion_reasons,
        "score": total_score if not exclusion_reasons else 0,
        "raw_score": total_score,
        "components": components,
        "explanation": explanation,
        "exclusion_reasons": exclusion_reasons,
        "available_capacity": available_capacity,
    }


def join_phrases(phrases):
    """['a', 'b', 'c'] -> 'a, b, and c'"""
    if len(phrases) <= 1:
        return "".join(phrases)
    return ", ".join(phrases[:-1]) + ", and " + phrases[-1]


def rank_ngos_for_donation(donation, ngos, now, capacity_lookup=None):
    """
    Score every NGO and split them into ranked recommendations and excluded NGOs.

    capacity_lookup: optional function ngo -> available capacity (tests pass a simple
    lambda; the real app uses get_available_capacity which reads the database).
    """
    capacity_lookup = capacity_lookup or get_available_capacity
    recommendations = []
    excluded = []
    for ngo in ngos:
        result = calculate_match_score(donation, ngo, capacity_lookup(ngo), now)
        entry = {"ngo": ngo.to_public_dict(), **result}
        if result["eligible"]:
            recommendations.append(entry)
        else:
            excluded.append(entry)

    # Highest score first; ties broken by more spare capacity, then by name (deterministic).
    recommendations.sort(key=lambda e: (-e["score"], -e["available_capacity"], e["ngo"]["organization_name"]))
    excluded.sort(key=lambda e: e["ngo"]["organization_name"])
    for position, entry in enumerate(recommendations, start=1):
        entry["rank"] = position

    return {
        "weights": WEIGHTS,
        "location_basis": LOCATION_BASIS,
        "recommendations": recommendations,
        "excluded": excluded,
    }


def rank_donations_for_ngo(ngo, donations, now, available_capacity=None):
    """The same algorithm in reverse: which open donations suit this NGO best?"""
    if available_capacity is None:
        available_capacity = get_available_capacity(ngo)
    ranked = []
    for donation in donations:
        result = calculate_match_score(donation, ngo, available_capacity, now)
        if result["eligible"]:
            ranked.append({"donation": donation.to_dict(), **result})
    ranked.sort(key=lambda e: (-e["score"], e["donation"]["pickup_deadline"] or "", e["donation"]["id"]))
    return ranked
