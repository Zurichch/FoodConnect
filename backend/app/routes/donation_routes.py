"""
donation_routes.py - Creating, listing, viewing, editing, cancelling and
tracking donations, plus NGO matching recommendations.

Request-response cycle for "create donation":
  React form -> POST /api/donations (JSON + token)
    -> auth_required("donor") loads the donor from the token
    -> parse_donation_form() checks every field         (400 if invalid)
    -> check_food_safety() checks times and handling     (422 if unsafe/expired)
    -> Donation row + first status-history row saved to SQLite
    -> JSON response with the new donation              (201 Created)
"""
from datetime import timedelta

from flask import Blueprint, request
from sqlalchemy import func, or_

from ..extensions import db
from ..models import CollectionRequest, Donation, DonationReport, NGOProfile
from ..services.food_safety import DISCLAIMER, build_safety_checklist, check_food_safety
from ..services.lifecycle import (
    ALLOWED_TRANSITIONS,
    CANCELLABLE_BY_DONOR,
    FINAL_STATUSES,
    IN_PROGRESS,
    NGO_UPDATABLE_STATUSES,
    NORMAL_FLOW,
    OPEN_FOR_REQUESTS,
    add_history_entry,
    change_status,
    expire_overdue_donations,
    reject_pending_requests,
    safety_warnings_to_json,
)
from ..services.matching import get_available_capacity, rank_donations_for_ngo, rank_ngos_for_donation
from ..services.notification_service import notify_admins, notify_user
from ..utils.auth_helpers import auth_required, current_ngo_profile, current_user
from ..utils.constants import (
    ALL_DONATION_STATUSES,
    DIETARY_TYPES,
    FOOD_CATEGORIES,
    QUANTITY_UNITS,
    REQUEST_PENDING,
    STATUS_AVAILABLE,
    STATUS_CANCELLED,
    STATUS_COLLECTED,
    STATUS_DELIVERED,
    STATUS_PICKUP_SCHEDULED,
    STORAGE_TYPES,
    VERIFICATION_VERIFIED,
)
from ..utils.responses import ApiError, paginate_query, success_response
from ..utils.time_utils import to_iso, utc_now
from ..utils.validators import (
    get_json_body,
    raise_if_errors,
    read_bool,
    read_choice,
    read_datetime,
    read_float,
    read_int,
    read_pagination,
    read_string,
)

donation_bp = Blueprint("donations", __name__, url_prefix="/api/donations")


# ============================================================ helpers
def get_donation_or_404(donation_id):
    donation = db.session.get(Donation, donation_id)
    if donation is None:
        raise ApiError("Donation not found.", 404, "NOT_FOUND")
    return donation


def parse_donation_form(data):
    """Read and validate every donation field. Raises 400 with per-field messages."""
    errors = {}
    fields = {
        "food_name": read_string(data, "food_name", errors, required=True, max_length=150),
        "category": read_choice(data, "category", FOOD_CATEGORIES, errors, required=True),
        "description": read_string(data, "description", errors, max_length=2000),
        "quantity": read_float(data, "quantity", errors, required=True, minimum=0.1, maximum=100000),
        "quantity_unit": read_choice(data, "quantity_unit", QUANTITY_UNITS, errors, required=True),
        "servings": read_int(data, "servings", errors, required=True, minimum=1, maximum=5000),
        "dietary_type": read_choice(data, "dietary_type", DIETARY_TYPES, errors, required=True),
        "is_packaged": read_bool(data, "is_packaged"),
        "storage_type": read_choice(data, "storage_type", STORAGE_TYPES, errors, required=True),
        "allergens": read_string(data, "allergens", errors, max_length=255),
        "prepared_at": read_datetime(data, "prepared_at", errors, required=True),
        "expires_at": read_datetime(data, "expires_at", errors, required=True),
        "pickup_deadline": read_datetime(data, "pickup_deadline", errors, required=True),
        "pickup_address": read_string(data, "pickup_address", errors, required=True, max_length=255),
        "pickup_area": read_string(data, "pickup_area", errors, required=True, max_length=100),
        "pickup_postal_code": read_string(data, "pickup_postal_code", errors, required=True, max_length=10),
        "notes": read_string(data, "notes", errors, max_length=2000),
        "safety_declaration": read_bool(data, "safety_declaration"),
    }
    raise_if_errors(errors)
    return fields


def run_safety_check_or_raise(fields, now):
    result = check_food_safety(fields, now)
    if not result["is_publishable"]:
        raise ApiError(
            "This donation failed the food safety checks and cannot be published.",
            422,
            "SAFETY_CHECK_FAILED",
            result["errors"],
        )
    return result


def user_ngo_profile(user):
    return user.ngo_profile if user.role == "ngo" else None


def ngo_has_request(ngo, donation):
    return ngo is not None and any(r.ngo_id == ngo.id for r in donation.requests)


def can_view_donation(user, donation):
    if user.role == "admin" or donation.donor_id == user.id:
        return True
    ngo = user_ngo_profile(user)
    if ngo is None:
        return False
    return donation.status in OPEN_FOR_REQUESTS or donation.assigned_ngo_id == ngo.id or ngo_has_request(ngo, donation)


def can_view_private_details(user, donation):
    ngo = user_ngo_profile(user)
    return (
        user.role == "admin"
        or donation.donor_id == user.id
        or (ngo is not None and donation.assigned_ngo_id == ngo.id)
    )


def allowed_actions_for(user, donation):
    """Which buttons the frontend should show. The backend re-checks each action anyway."""
    actions = []
    next_statuses = ALLOWED_TRANSITIONS.get(donation.status, set())
    if user.role == "donor" and donation.donor_id == user.id:
        if donation.status in CANCELLABLE_BY_DONOR:
            actions.append("cancel")
        if donation.status in OPEN_FOR_REQUESTS:
            actions.append("view_matches")
        if donation.status == STATUS_AVAILABLE and not donation.requests:
            actions.append("edit")
    ngo = user_ngo_profile(user)
    if ngo is not None:
        if donation.status in OPEN_FOR_REQUESTS and not ngo_has_request(ngo, donation):
            actions.append("request")
        if donation.assigned_ngo_id == ngo.id:
            for status in [STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED, STATUS_DELIVERED]:
                if status in next_statuses:
                    actions.append(f"set_{status.lower()}")
    if user.role != "admin" and donation.donor_id != user.id:
        actions.append("report")
    if user.role == "admin" and donation.status not in FINAL_STATUSES and "REJECTED" in next_statuses:
        actions.append("moderate_reject")
    return actions


# ============================================================ donor endpoints
@donation_bp.post("/safety-check")
@auth_required("donor")
def preview_safety_check():
    """Run the safety rules WITHOUT saving - used for live feedback on the form."""
    data = get_json_body()
    errors = {}
    fields = {
        "category": data.get("category"),
        "storage_type": data.get("storage_type"),
        "is_packaged": read_bool(data, "is_packaged"),
        "allergens": data.get("allergens"),
        "safety_declaration": read_bool(data, "safety_declaration"),
        "prepared_at": read_datetime(data, "prepared_at", errors),
        "expires_at": read_datetime(data, "expires_at", errors),
        "pickup_deadline": read_datetime(data, "pickup_deadline", errors),
    }
    result = check_food_safety(fields, utc_now())
    result["errors"].update(errors)
    result["is_publishable"] = result["is_publishable"] and not errors
    result["disclaimer"] = DISCLAIMER
    return success_response(result)


@donation_bp.post("")
@auth_required("donor")
def create_donation():
    donor = current_user()
    now = utc_now()
    fields = parse_donation_form(get_json_body())
    safety = run_safety_check_or_raise(fields, now)

    # donor_id comes from the login token - never from the form.
    donation = Donation(
        donor_id=donor.id,
        status=STATUS_AVAILABLE,
        safety_warnings=safety_warnings_to_json(safety["warnings"]),
        created_at=now,
        **fields,
    )
    db.session.add(donation)
    add_history_entry(donation, None, STATUS_AVAILABLE, donor, "Donation created and passed safety checks")
    db.session.commit()
    return success_response(
        {"donation": donation.to_dict(include_private=True), "safety": safety},
        "Donation published. See the recommended NGOs below.",
        201,
    )


@donation_bp.get("/mine")
@auth_required("donor")
def list_my_donations():
    expire_overdue_donations()
    donor = current_user()
    page, per_page = read_pagination()
    query = Donation.query.filter(Donation.donor_id == donor.id)

    scope = request.args.get("scope", "all")
    if scope == "active":
        query = query.filter(Donation.status.notin_(FINAL_STATUSES))
    elif scope == "history":
        query = query.filter(Donation.status.in_(FINAL_STATUSES))
    status = request.args.get("status")
    if status in ALL_DONATION_STATUSES:
        query = query.filter(Donation.status == status)
    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(Donation.food_name.ilike(f"%{search}%"))

    query = query.order_by(Donation.created_at.desc())
    result = paginate_query(query, page, per_page, lambda d: dict(
        d.to_dict(include_private=True),
        pending_requests=sum(1 for r in d.requests if r.status == REQUEST_PENDING),
    ))
    return success_response(result)


@donation_bp.put("/<int:donation_id>")
@auth_required("donor")
def update_donation(donation_id):
    donation = get_donation_or_404(donation_id)
    donor = current_user()
    if donation.donor_id != donor.id:
        raise ApiError("You can only edit your own donations.", 403, "FORBIDDEN")
    if donation.status != STATUS_AVAILABLE or donation.requests:
        raise ApiError("Only available donations without any requests can be edited.", 409, "NOT_EDITABLE")

    now = utc_now()
    fields = parse_donation_form(get_json_body())
    safety = run_safety_check_or_raise(fields, now)
    for key, value in fields.items():
        setattr(donation, key, value)
    donation.safety_warnings = safety_warnings_to_json(safety["warnings"])
    donation.updated_at = now
    db.session.commit()
    return success_response({"donation": donation.to_dict(include_private=True), "safety": safety}, "Donation updated.")


@donation_bp.post("/<int:donation_id>/cancel")
@auth_required("donor")
def cancel_donation(donation_id):
    donation = get_donation_or_404(donation_id)
    donor = current_user()
    if donation.donor_id != donor.id:
        raise ApiError("You can only cancel your own donations.", 403, "FORBIDDEN")
    if donation.status not in CANCELLABLE_BY_DONOR:
        raise ApiError(f"A {donation.status} donation can no longer be cancelled.", 409, "NOT_CANCELLABLE")

    reason = read_string(get_json_body(), "reason", {}, max_length=255) or "Cancelled by donor"
    change_status(donation, STATUS_CANCELLED, donor, reason)
    donation.cancel_reason = reason
    reject_pending_requests(donation, "the donor cancelled the donation")
    if donation.assigned_ngo:
        notify_user(
            donation.assigned_ngo.user_id, "Donation cancelled",
            f"'{donation.food_name}' was cancelled by the donor. Reason: {reason}",
            "donation_cancelled", donation.id,
        )
    db.session.commit()
    return success_response(donation.to_dict(include_private=True), "Donation cancelled.")


@donation_bp.get("/<int:donation_id>/matches")
@auth_required("donor", "admin")
def get_matches(donation_id):
    """Ranked NGO recommendations with score breakdowns, computed live by matching.py."""
    donation = get_donation_or_404(donation_id)
    user = current_user()
    if user.role == "donor" and donation.donor_id != user.id:
        raise ApiError("You can only view matches for your own donations.", 403, "FORBIDDEN")

    now = utc_now()
    if donation.status not in OPEN_FOR_REQUESTS:
        return success_response({
            "donation": donation.to_dict(include_private=True),
            "recommendations": [], "excluded": [],
            "message": f"Matching is only shown while a donation is open (current status: {donation.status}).",
        })

    ngos = NGOProfile.query.order_by(NGOProfile.organization_name).all()
    result = rank_ngos_for_donation(donation, ngos, now)
    # Tell the donor which NGOs already have a pending request/offer for this donation.
    request_by_ngo = {r.ngo_id: r for r in donation.requests}
    for entry in result["recommendations"] + result["excluded"]:
        existing = request_by_ngo.get(entry["ngo"]["id"])
        entry["existing_request"] = existing.to_dict(include_donation=False) if existing else None
    result["donation"] = donation.to_dict(include_private=True)
    # Unverified NGOs are not shown to donors at all (only counted) to avoid confusion.
    result["excluded"] = [e for e in result["excluded"] if e["ngo"]["verification_status"] == VERIFICATION_VERIFIED]
    return success_response(result)


# ============================================================ NGO endpoints
@donation_bp.get("/available")
@auth_required("ngo")
def list_available_donations():
    """Open donations with filters: area, category, dietary, servings, deadline, storage."""
    expire_overdue_donations()
    ngo = current_ngo_profile()
    page, per_page = read_pagination()
    args = request.args
    query = Donation.query.filter(Donation.status.in_(OPEN_FOR_REQUESTS))

    if args.get("my_area") == "true":
        areas = [a.lower() for a in ngo.service_area_list()]
        postals = ngo.postal_code_list()
        query = query.filter(or_(func.lower(Donation.pickup_area).in_(areas), Donation.pickup_postal_code.in_(postals)))
    area = (args.get("area") or "").strip()
    if area:
        query = query.filter(or_(Donation.pickup_area.ilike(f"%{area}%"), Donation.pickup_postal_code.like(f"{area}%")))
    if args.get("category") in FOOD_CATEGORIES:
        query = query.filter(Donation.category == args["category"])
    if args.get("dietary_type") in DIETARY_TYPES:
        query = query.filter(Donation.dietary_type == args["dietary_type"])
    if args.get("storage_type") in STORAGE_TYPES:
        query = query.filter(Donation.storage_type == args["storage_type"])
    try:
        if args.get("min_servings"):
            query = query.filter(Donation.servings >= int(args["min_servings"]))
        if args.get("max_servings"):
            query = query.filter(Donation.servings <= int(args["max_servings"]))
        if args.get("deadline_within_hours"):
            limit = utc_now() + timedelta(hours=float(args["deadline_within_hours"]))
            query = query.filter(Donation.pickup_deadline <= limit)
    except ValueError:
        raise ApiError("Numeric filters must be numbers.", 400, "VALIDATION_ERROR")

    sort = args.get("sort", "deadline")
    if sort == "newest":
        query = query.order_by(Donation.created_at.desc())
    elif sort == "servings":
        query = query.order_by(Donation.servings.desc())
    else:
        query = query.order_by(Donation.pickup_deadline.asc())

    requested_ids = {r.donation_id for r in CollectionRequest.query.filter_by(ngo_id=ngo.id).all()}
    result = paginate_query(query, page, per_page, lambda d: dict(d.to_dict(), already_requested=d.id in requested_ids))
    return success_response(result)


@donation_bp.get("/recommended")
@auth_required("ngo")
def recommended_for_ngo():
    """Open donations ranked for THIS NGO using the same matching algorithm."""
    expire_overdue_donations()
    ngo = current_ngo_profile()
    if not ngo.is_verified:
        return success_response({
            "items": [], "available_capacity": get_available_capacity(ngo),
            "message": "Recommendations appear after an administrator verifies your NGO.",
        })
    requested_ids = {r.donation_id for r in CollectionRequest.query.filter_by(ngo_id=ngo.id).all()}
    open_donations = [
        d for d in Donation.query.filter(Donation.status.in_(OPEN_FOR_REQUESTS)).all() if d.id not in requested_ids
    ]
    ranked = rank_donations_for_ngo(ngo, open_donations, utc_now())
    return success_response({"items": ranked[:20], "available_capacity": get_available_capacity(ngo)})


@donation_bp.get("/collections")
@auth_required("ngo")
def list_ngo_collections():
    """?scope=active -> accepted/scheduled/collected; ?scope=completed -> delivered and other final outcomes."""
    expire_overdue_donations()
    ngo = current_ngo_profile()
    page, per_page = read_pagination()
    query = Donation.query.filter(Donation.assigned_ngo_id == ngo.id)
    if request.args.get("scope", "active") == "completed":
        query = query.filter(Donation.status.in_(FINAL_STATUSES)).order_by(Donation.updated_at.desc())
    else:
        query = query.filter(Donation.status.in_(IN_PROGRESS)).order_by(Donation.pickup_deadline.asc())
    return success_response(paginate_query(query, page, per_page, lambda d: d.to_dict(include_private=True)))


@donation_bp.post("/<int:donation_id>/status")
@auth_required("ngo")
def update_collection_status(donation_id):
    """The assigned NGO moves the donation: PICKUP_SCHEDULED -> COLLECTED -> DELIVERED."""
    donation = get_donation_or_404(donation_id)
    ngo = current_ngo_profile()
    user = current_user()
    if donation.assigned_ngo_id != ngo.id:
        raise ApiError("Only the NGO assigned to this donation can update its collection status.", 403, "FORBIDDEN")

    data = get_json_body()
    errors = {}
    new_status = read_choice(data, "status", sorted(NGO_UPDATABLE_STATUSES), errors, required=True)
    note = read_string(data, "note", errors, max_length=500)
    scheduled_at = read_datetime(data, "scheduled_pickup_at", errors)
    servings_distributed = read_int(data, "servings_distributed", errors, minimum=0, maximum=donation.servings)
    if new_status == STATUS_PICKUP_SCHEDULED and scheduled_at is None:
        errors["scheduled_pickup_at"] = "Choose the planned pickup time."
    if scheduled_at and scheduled_at > donation.pickup_deadline:
        errors["scheduled_pickup_at"] = "Pickup must be planned before the donor's pickup deadline."
    raise_if_errors(errors)

    now = utc_now()
    if new_status in (STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED) and donation.expires_at <= now:
        raise ApiError("This food has passed its use-by time and must not be collected.", 422, "FOOD_EXPIRED")

    change_status(donation, new_status, user, note, now)
    if new_status == STATUS_PICKUP_SCHEDULED:
        donation.scheduled_pickup_at = scheduled_at
        notify_user(donation.donor_id, "Pickup scheduled",
                    f"{ngo.organization_name} will pick up '{donation.food_name}' around the scheduled time. Please keep it ready for collection.",
                    "pickup_scheduled", donation.id)
    elif new_status == STATUS_COLLECTED:
        notify_user(donation.donor_id, "Donation collected",
                    f"{ngo.organization_name} has collected '{donation.food_name}'. Thank you!",
                    "donation_collected", donation.id)
    elif new_status == STATUS_DELIVERED:
        donation.servings_distributed = servings_distributed if servings_distributed is not None else donation.servings
        notify_user(donation.donor_id, "Donation delivered",
                    f"'{donation.food_name}' reached people in need ({donation.servings_distributed} servings distributed).",
                    "donation_delivered", donation.id)
    db.session.commit()
    return success_response(donation.to_dict(include_private=True), f"Status updated to {new_status}.")


# ============================================================ shared endpoints
@donation_bp.get("/<int:donation_id>")
@auth_required()
def get_donation_details(donation_id):
    expire_overdue_donations()
    donation = get_donation_or_404(donation_id)
    user = current_user()
    if not can_view_donation(user, donation):
        raise ApiError("You do not have access to this donation.", 403, "FORBIDDEN")

    ngo = user_ngo_profile(user)
    if user.role == "admin" or donation.donor_id == user.id:
        visible_requests = donation.requests
    else:
        visible_requests = [r for r in donation.requests if ngo and r.ngo_id == ngo.id]

    return success_response({
        "donation": donation.to_dict(include_private=can_view_private_details(user, donation)),
        "history": [h.to_dict() for h in donation.status_history],
        "requests": [r.to_dict(include_donation=False) for r in visible_requests],
        "safety_checklist": build_safety_checklist(donation, utc_now()),
        "safety_disclaimer": DISCLAIMER,
        "normal_flow": NORMAL_FLOW,
        "allowed_actions": allowed_actions_for(user, donation),
        "tracking_note": "Status tracking only - FoodConnect does not use live GPS location.",
        "server_time": to_iso(utc_now()),
    })


@donation_bp.post("/<int:donation_id>/report")
@auth_required("donor", "ngo")
def report_donation(donation_id):
    donation = get_donation_or_404(donation_id)
    user = current_user()
    if donation.donor_id == user.id:
        raise ApiError("You cannot report your own donation.", 400, "INVALID_REPORT")
    if not can_view_donation(user, donation):
        raise ApiError("You do not have access to this donation.", 403, "FORBIDDEN")
    errors = {}
    reason = read_string(get_json_body(), "reason", errors, required=True, max_length=500)
    raise_if_errors(errors)
    db.session.add(DonationReport(donation_id=donation.id, reporter_id=user.id, reason=reason))
    notify_admins("Donation reported", f"'{donation.food_name}' (#{donation.id}) was reported: {reason}", "report", donation.id)
    db.session.commit()
    return success_response(None, "Thank you. An administrator will review this report.", 201)
