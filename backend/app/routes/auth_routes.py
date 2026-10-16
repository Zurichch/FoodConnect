"""
auth_routes.py - Register, log in, log out and "who am I".

Authentication in one paragraph:
  At login we check the email + password against the stored password hash.
  If correct, we create a JWT (JSON Web Token) - a signed string containing the
  user's id. The frontend stores it and sends it back in the Authorization
  header. The signature proves the token was made by our server, so nobody can
  edit it to pretend to be someone else.
"""
from flask import Blueprint
from flask_jwt_extended import create_access_token, get_jwt

from ..extensions import db
from ..models import NGOProfile, TokenBlocklist, User
from ..services.notification_service import notify_admins
from ..utils.auth_helpers import auth_required, current_user
from ..utils.constants import (
    DONOR_TYPES,
    FOOD_CATEGORIES,
    NGO_DIETARY_PREFERENCES,
    ROLE_NGO,
    SELF_REGISTER_ROLES,
    VERIFICATION_PENDING,
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
    validate_email,
    validate_password_strength,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def make_login_response(user, message):
    # The token stores only the user id (as text). Role is added for convenience,
    # but every protected route re-reads the role from the database anyway.
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return success_response({"token": token, "user": user.to_dict()}, message)


@auth_bp.post("/register")
def register():
    data = get_json_body()
    errors = {}
    name = read_string(data, "name", errors, required=True, max_length=120)
    email = (read_string(data, "email", errors, required=True, max_length=120) or "").lower()
    password = read_string(data, "password", errors, required=True, max_length=128)
    role = read_choice(data, "role", SELF_REGISTER_ROLES, errors, required=True)
    phone = read_string(data, "phone", errors, required=True, max_length=30)
    area = read_string(data, "area", errors, required=True, max_length=100)
    postal_code = read_string(data, "postal_code", errors, required=True, max_length=10)
    address = read_string(data, "address", errors, max_length=255)
    validate_email(email, errors)
    validate_password_strength(password, errors)

    donor_type = None
    if role == "donor":
        donor_type = read_choice(data, "donor_type", DONOR_TYPES, errors, default="individual")

    # Extra fields required when registering an NGO
    if role == ROLE_NGO:
        organization_name = read_string(data, "organization_name", errors, required=True, max_length=150)
        service_areas = read_list_as_csv(data, "service_areas", errors)
        if not service_areas:
            errors["service_areas"] = "Enter at least one service area."
        max_capacity = read_int(data, "max_capacity_servings", errors, required=True, minimum=1, maximum=10000)

    if email and User.query.filter_by(email=email).first():
        errors["email"] = "An account with this email already exists."
    raise_if_errors(errors)

    user = User(
        name=name, email=email, role=role, phone=phone, area=area,
        postal_code=postal_code, address=address, donor_type=donor_type,
    )
    user.set_password(password)
    db.session.add(user)

    if role == ROLE_NGO:
        profile = NGOProfile(
            user=user,
            organization_name=organization_name,
            registration_number=read_string(data, "registration_number", errors, max_length=60),
            address=address,
            service_areas=service_areas or area,
            postal_codes=read_list_as_csv(data, "postal_codes", errors) or postal_code,
            contact_phone=phone,
            contact_email=email,
            max_capacity_servings=max_capacity,
            pickup_lead_time_minutes=read_int(data, "pickup_lead_time_minutes", errors, minimum=10, maximum=600, default=60),
            preferred_categories=read_list_as_csv(data, "preferred_categories", errors, allowed=FOOD_CATEGORIES),
            dietary_preference=read_choice(data, "dietary_preference", NGO_DIETARY_PREFERENCES, errors, default="any"),
            opening_time=read_time_of_day(data, "opening_time", errors, default="09:00"),
            closing_time=read_time_of_day(data, "closing_time", errors, default="21:00"),
            can_store_refrigerated=read_bool(data, "can_store_refrigerated"),
            can_store_frozen=read_bool(data, "can_store_frozen"),
            accepts_unpackaged=read_bool(data, "accepts_unpackaged", default=True),
            verification_status=VERIFICATION_PENDING,
        )
        raise_if_errors(errors)
        db.session.add(profile)
        notify_admins("New NGO awaiting verification", f"{organization_name} registered and needs verification.")

    db.session.commit()
    message = "Registration successful."
    if role == ROLE_NGO:
        message += " Your NGO will appear in recommendations after an administrator verifies it."
    response, _ = make_login_response(user, message)
    return response, 201


@auth_bp.post("/login")
def login():
    data = get_json_body()
    errors = {}
    email = (read_string(data, "email", errors, required=True) or "").lower()
    password = read_string(data, "password", errors, required=True)
    raise_if_errors(errors)

    user = User.query.filter_by(email=email).first()
    # Same message for "no such user" and "wrong password" so attackers cannot
    # discover which emails are registered.
    if user is None or not user.check_password(password):
        raise ApiError("Incorrect email or password.", 401, "INVALID_CREDENTIALS")
    if user.is_suspended:
        raise ApiError("This account has been suspended. Contact support.", 403, "ACCOUNT_SUSPENDED")
    return make_login_response(user, f"Welcome back, {user.name}!")


@auth_bp.post("/logout")
@auth_required()
def logout():
    # Store the token's unique id so the same token can never be used again.
    db.session.add(TokenBlocklist(jti=get_jwt()["jti"]))
    db.session.commit()
    return success_response(None, "Logged out successfully.")


@auth_bp.get("/me")
@auth_required()
def me():
    user = current_user()
    data = user.to_dict()
    if user.ngo_profile:
        data["ngo_profile"] = user.ngo_profile.to_dict()
    return success_response(data)
