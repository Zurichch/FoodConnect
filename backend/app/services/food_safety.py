"""
food_safety.py - Time and handling checks for a donation.

IMPORTANT: FoodConnect can NOT certify that food is safe. These checks only
catch information that is clearly wrong or risky (already expired, deadlines
in the wrong order, very long holding times ...). Donors remain responsible
for the accuracy of what they enter and for following local food-safety law.

Two kinds of results:
  * errors   -> the donation is blocked and cannot be published.
  * warnings -> the donation can be published but the warnings are shown
                to NGOs and stored with the donation.

The matching score can never override these results: an expired or blocked
donation never reaches the matching step.
"""
from ..utils.time_utils import hours_between, to_iso

# ---- Rules (documented in docs/MATCHING_ALGORITHM.md and README) ----
MIN_PICKUP_NOTICE_MINUTES = 30          # NGOs need at least 30 minutes to reach the donor
PREPARED_TIME_TOLERANCE_MINUTES = 10    # small allowance for clock differences
URGENT_EXPIRY_HOURS = 2                 # use-by within 2 hours -> "urgent" warning
MAX_PREPARED_AGE_HOURS = 72             # older than 3 days -> blocked (for perishable food)

# Guideline: hours between preparation and declared use-by time above which we
# warn the donor to double-check (perishable categories only).
RECOMMENDED_MAX_HOLDING_HOURS = {
    "room_temperature": 6,
    "refrigerated": 48,
    "frozen": 24 * 30,
}
PERISHABLE_CATEGORIES = {"cooked_meals", "dairy", "bakery"}

DISCLAIMER = (
    "FoodConnect does not certify food safety. The donor is responsible for accurate "
    "information and for complying with applicable local food-safety regulations."
)


def check_food_safety(details, now):
    """
    details: dict with prepared_at, expires_at, pickup_deadline (datetimes),
             storage_type, category, is_packaged, allergens, safety_declaration
    now:     the current UTC time (passed in so tests can control time)

    Returns {"errors": {field: message}, "warnings": [text], "is_publishable": bool}
    """
    errors = {}
    warnings = []

    prepared_at = details.get("prepared_at")
    expires_at = details.get("expires_at")
    pickup_deadline = details.get("pickup_deadline")
    storage_type = details.get("storage_type")
    category = details.get("category")

    # 1. The three times must be present.
    for field in ("prepared_at", "expires_at", "pickup_deadline"):
        if details.get(field) is None:
            errors[field] = "This time is required for food safety checks."
    if errors:
        return {"errors": errors, "warnings": warnings, "is_publishable": False}

    # 2. Preparation time cannot be in the future.
    if hours_between(now, prepared_at) * 60 > PREPARED_TIME_TOLERANCE_MINUTES:
        errors["prepared_at"] = "Preparation / availability time cannot be in the future."

    # 3. Already expired food can never be published.
    if expires_at <= now:
        errors["expires_at"] = "This food is already past its use-by / expiry time and cannot be donated."

    # 4. Use-by must be after preparation.
    if expires_at <= prepared_at:
        errors["expires_at"] = "Use-by / expiry time must be after the preparation time."

    # 5. The pickup deadline must be in the future with enough notice for an NGO to travel.
    minutes_until_deadline = hours_between(now, pickup_deadline) * 60
    if minutes_until_deadline <= 0:
        errors["pickup_deadline"] = "Pickup deadline has already passed."
    elif minutes_until_deadline < MIN_PICKUP_NOTICE_MINUTES:
        errors["pickup_deadline"] = (
            f"Pickup deadline must be at least {MIN_PICKUP_NOTICE_MINUTES} minutes from now "
            "so an NGO has time to reach you."
        )

    # 6. Food must still be within its use-by time when it is collected.
    if pickup_deadline > expires_at:
        errors["pickup_deadline"] = "Pickup deadline must be on or before the use-by / expiry time."

    # 7. Very old perishable food is blocked.
    if category in PERISHABLE_CATEGORIES and storage_type != "frozen":
        if hours_between(prepared_at, now) > MAX_PREPARED_AGE_HOURS:
            errors["prepared_at"] = (
                f"Perishable food prepared more than {MAX_PREPARED_AGE_HOURS} hours ago cannot be donated."
            )

    # 8. Donor must confirm the safety declaration.
    if not details.get("safety_declaration"):
        errors["safety_declaration"] = "Please confirm the food safety declaration."

    # ---- Warnings (do not block publishing) ----
    if not errors:
        if hours_between(now, expires_at) <= URGENT_EXPIRY_HOURS:
            warnings.append("Urgent: the food reaches its use-by time within 2 hours.")

        holding_limit = RECOMMENDED_MAX_HOLDING_HOURS.get(storage_type)
        if category in PERISHABLE_CATEGORIES and holding_limit:
            if hours_between(prepared_at, expires_at) > holding_limit:
                warnings.append(
                    f"Declared use-by is more than {holding_limit} hours after preparation for "
                    f"{storage_type.replace('_', ' ')} storage. Please double-check this time."
                )

        if category == "cooked_meals" and not details.get("is_packaged"):
            warnings.append("Unpackaged cooked food: keep it covered and use clean containers for handover.")

        if storage_type in ("refrigerated", "frozen"):
            warnings.append(
                f"Requires {storage_type} handling: the collecting NGO must keep the cold chain."
            )

        if not details.get("allergens"):
            warnings.append("No allergen information was provided.")

    return {"errors": errors, "warnings": warnings, "is_publishable": not errors}


def build_safety_checklist(donation, now):
    """
    The checklist shown on the donation details page.
    Each item: {"label", "value", "status"} where status is "ok", "warning" or "missing".
    """
    expired = donation.expires_at <= now
    deadline_passed = donation.pickup_deadline <= now
    return [
        {
            "label": "Preparation / availability time",
            "value": to_iso(donation.prepared_at),
            "status": "ok" if donation.prepared_at else "missing",
        },
        {
            "label": "Declared use-by / expiry time",
            "value": to_iso(donation.expires_at),
            "status": "warning" if expired else "ok",
        },
        {
            "label": "Storage conditions",
            "value": (donation.storage_type or "").replace("_", " "),
            "status": "ok" if donation.storage_type else "missing",
        },
        {
            "label": "Packaging and handling",
            "value": "Packaged" if donation.is_packaged else "Unpackaged - keep covered",
            "status": "ok" if donation.is_packaged else "warning",
        },
        {
            "label": "Pickup deadline",
            "value": to_iso(donation.pickup_deadline),
            "status": "warning" if deadline_passed else "ok",
        },
        {
            "label": "Dietary / allergen information",
            "value": f"{donation.dietary_type.replace('_', '-')}; allergens: {donation.allergens or 'not provided'}",
            "status": "ok" if donation.allergens else "warning",
        },
    ]
