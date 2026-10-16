"""
profile_routes.py - View/update your own account, change password,
and the NGO organisation profile (capacity, preferences, service areas).
"""
from flask import Blueprint

from ..extensions import db
from ..services.analytics import ngo_analytics
from ..services.matching import get_available_capacity
from ..services.notification_service import notify_admins
from ..utils.auth_helpers import auth_required, current_ngo_profile, current_user
from ..utils.constants import (
    DONOR_TYPES,
    FOOD_CATEGORIES,
    NGO_DIETARY_PREFERENCES,
    VERIFICATION_PENDING,
    VERIFICATION_REJECTED,
)
from ..utils.responses import ApiError, success_response
from ..utils.validators import (
    get_json_body,
    raise_if_errors,
    read_bool,
    read_choice,
    read_int,
    read_list_as_csv,
    read_string,
    read_time_of_day,
    validate_password_strength,
)

profile_bp = Blueprint("profile", __name__, url_prefix="/api")


@profile_bp.get("/profile")
@auth_required()
def get_profile():
    return success_response(current_user().to_dict())


@profile_bp.put("/profile")
@auth_required()
def update_profile():
    """Update basic account details. Email and role can NOT be changed here."""
    user = current_user()
    data = get_json_body()
    errors = {}
    name = read_string(data, "name", errors, required=True, max_length=120)
    phone = read_string(data, "phone", errors, required=True, max_length=30)
    area = read_string(data, "area", errors, required=True, max_length=100)
    postal_code = read_string(data, "postal_code", errors, required=True, max_length=10)
    address = read_string(data, "address", errors, max_length=255)
    donor_type = user.donor_type
    if user.role == "donor":
        donor_type = read_choice(data, "donor_type", DONOR_TYPES, errors, default=user.donor_type or "individual")
    raise_if_errors(errors)

    user.name, user.phone, user.area, user.postal_code, user.address = name, phone, area, postal_code, address
    user.donor_type = donor_type
    db.session.commit()
    return success_response(user.to_dict(), "Profile updated.")


@profile_bp.put("/profile/password")
@auth_required()
def change_password():
    user = current_user()
    data = get_json_body()
    errors = {}
    current_password = read_string(data, "current_password", errors, required=True)
    new_password = read_string(data, "new_password", errors, required=True)
    validate_password_strength(new_password, errors, "new_password")
    raise_if_errors(errors)
    if not user.check_password(current_password):
        raise ApiError("Current password is incorrect.", 400, "VALIDATION_ERROR", {"current_password": "Incorrect password."})
    user.set_password(new_password)
    db.session.commit()
    return success_response(None, "Password changed.")


# ---------------------------------------------------------------- NGO profile
@profile_bp.get("/ngo/profile")
@auth_required("ngo")
def get_ngo_profile():
    return success_response(current_ngo_profile().to_dict())


@profile_bp.put("/ngo/profile")
@auth_required("ngo")
def update_ngo_profile():
    profile = current_ngo_profile()
    data = get_json_body()
    errors = {}
    organization_name = read_string(data, "organization_name", errors, required=True, max_length=150)
    service_areas = read_list_as_csv(data, "service_areas", errors)
    if not service_areas:
        errors["service_areas"] = "Enter at least one service area."
    postal_codes = read_list_as_csv(data, "postal_codes", errors)
    max_capacity = read_int(data, "max_capacity_servings", errors, required=True, minimum=1, maximum=10000)
    lead_time = read_int(data, "pickup_lead_time_minutes", errors, required=True, minimum=10, maximum=600)
    preferred = read_list_as_csv(data, "preferred_categories", errors, allowed=FOOD_CATEGORIES)
    dietary = read_choice(data, "dietary_preference", NGO_DIETARY_PREFERENCES, errors, required=True)
    opening_time = read_time_of_day(data, "opening_time", errors, required=True)
    closing_time = read_time_of_day(data, "closing_time", errors, required=True)
    registration_number = read_string(data, "registration_number", errors, max_length=60)
    description = read_string(data, "description", errors, max_length=2000)
    address = read_string(data, "address", errors, max_length=255)
    contact_phone = read_string(data, "contact_phone", errors, required=True, max_length=30)
    contact_email = read_string(data, "contact_email", errors, max_length=120)
    raise_if_errors(errors)

    profile.organization_name = organization_name
    profile.service_areas = service_areas
    profile.postal_codes = postal_codes
    profile.max_capacity_servings = max_capacity
    profile.pickup_lead_time_minutes = lead_time
    profile.preferred_categories = preferred
    profile.dietary_preference = dietary
    profile.opening_time = opening_time
    profile.closing_time = closing_time
    profile.registration_number = registration_number
    profile.description = description
    profile.address = address
    profile.contact_phone = contact_phone
    profile.contact_email = contact_email
    profile.can_store_refrigerated = read_bool(data, "can_store_refrigerated")
    profile.can_store_frozen = read_bool(data, "can_store_frozen")
    profile.accepts_unpackaged = read_bool(data, "accepts_unpackaged", default=True)

    message = "NGO profile updated."
    # A rejected NGO can fix its details and ask to be reviewed again.
    if profile.verification_status == VERIFICATION_REJECTED and read_bool(data, "request_reverification"):
        profile.verification_status = VERIFICATION_PENDING
        profile.verification_note = "Re-verification requested"
        notify_admins("NGO re-verification requested", f"{organization_name} updated its profile and asked to be verified again.")
        message += " Re-verification requested."
    db.session.commit()
    return success_response(profile.to_dict(), message)


@profile_bp.get("/ngo/dashboard")
@auth_required("ngo")
def ngo_dashboard():
    profile = current_ngo_profile()
    data = ngo_analytics(profile)
    data["profile"] = profile.to_dict()
    data["available_capacity"] = get_available_capacity(profile)
    return success_response(data)
