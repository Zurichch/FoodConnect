"""
collection_service.py - Business rules for collection requests.

Flow A (NGO asks):     NGO creates request  -> donor accepts / rejects
Flow B (donor offers): donor offers to NGO  -> NGO accepts / rejects

THE MOST IMPORTANT FUNCTION here is accept_collection_request(). It makes sure
two NGOs can never both get the same donation, even if two "accept" clicks
arrive at the same moment. It does this with a *conditional UPDATE*:

    UPDATE donations SET status='ACCEPTED', assigned_ngo_id=...
    WHERE id = <donation> AND status = 'REQUESTED' AND assigned_ngo_id IS NULL

The database runs this as one atomic step. The first call changes 1 row and
wins; any later call finds the status is no longer REQUESTED, changes 0 rows,
and gets a "409 Conflict - already claimed" error.
"""
from sqlalchemy import update

from ..extensions import db
from ..models import CollectionRequest, Donation
from ..utils.constants import (
    REQUEST_ACCEPTED,
    REQUEST_PENDING,
    REQUEST_REJECTED,
    REQUEST_WITHDRAWN,
    STATUS_ACCEPTED,
    STATUS_AVAILABLE,
    STATUS_REQUESTED,
)
from ..utils.responses import ApiError
from ..utils.time_utils import utc_now
from .lifecycle import OPEN_FOR_REQUESTS, add_history_entry, change_status, has_pending_requests, reject_pending_requests
from .matching import calculate_match_score, get_available_capacity
from .notification_service import notify_user

# When an NGO asks for a donation itself, every hard filter applies except
# location (an NGO may choose to travel further than its usual service area).
NGO_SELF_REQUEST_IGNORED_EXCLUSIONS = {"LOCATION"}


def ensure_donation_is_open(donation, now):
    if donation.status not in OPEN_FOR_REQUESTS:
        raise ApiError("This donation is no longer open for requests.", 409, "DONATION_NOT_AVAILABLE")
    if donation.pickup_deadline <= now or donation.expires_at <= now:
        raise ApiError("This donation's pickup time has passed.", 409, "DONATION_EXPIRED")


def mark_requested(donation, actor, note, now):
    """The first pending request moves the donation from AVAILABLE to REQUESTED."""
    if donation.status == STATUS_AVAILABLE:
        change_status(donation, STATUS_REQUESTED, actor, note, now)


def create_ngo_request(donation, ngo, acting_user, message=None, now=None):
    now = now or utc_now()
    ensure_donation_is_open(donation, now)
    if CollectionRequest.query.filter_by(donation_id=donation.id, ngo_id=ngo.id).first():
        raise ApiError("Your organisation has already requested this donation.", 409, "DUPLICATE_REQUEST")

    match = calculate_match_score(donation, ngo, get_available_capacity(ngo), now)
    blocking = [r for r in match["exclusion_reasons"] if r["code"] not in NGO_SELF_REQUEST_IGNORED_EXCLUSIONS]
    if blocking:
        raise ApiError(
            "Your organisation cannot request this donation: " + "; ".join(r["reason"] for r in blocking) + ".",
            422,
            "NOT_ELIGIBLE",
            {"reasons": blocking},
        )

    collection_request = CollectionRequest(
        donation=donation,
        ngo=ngo,
        initiated_by="ngo",
        status=REQUEST_PENDING,
        message=message,
        match_score=match["raw_score"],
        created_at=now,
    )
    db.session.add(collection_request)
    mark_requested(donation, acting_user, f"Collection requested by {ngo.organization_name}", now)
    notify_user(
        donation.donor_id,
        "New collection request",
        f"{ngo.organization_name} wants to collect '{donation.food_name}'. Review the request to accept or reject it.",
        "request_received",
        donation.id,
    )
    db.session.commit()
    return collection_request


def create_donor_offer(donation, ngo, acting_user, message=None, now=None):
    """The donor picks a recommended NGO and offers the donation to it."""
    now = now or utc_now()
    ensure_donation_is_open(donation, now)
    existing = CollectionRequest.query.filter_by(donation_id=donation.id, ngo_id=ngo.id).first()
    if existing:
        raise ApiError("This NGO already has a request for this donation.", 409, "DUPLICATE_REQUEST")

    match = calculate_match_score(donation, ngo, get_available_capacity(ngo), now)
    if not match["eligible"]:
        raise ApiError(
            "This NGO is not eligible for this donation: " + "; ".join(r["reason"] for r in match["exclusion_reasons"]) + ".",
            422,
            "NOT_ELIGIBLE",
            {"reasons": match["exclusion_reasons"]},
        )

    collection_request = CollectionRequest(
        donation=donation,
        ngo=ngo,
        initiated_by="donor",
        status=REQUEST_PENDING,
        message=message,
        match_score=match["score"],
        created_at=now,
    )
    db.session.add(collection_request)
    mark_requested(donation, acting_user, f"Offered to {ngo.organization_name}", now)
    notify_user(
        ngo.user_id,
        "Donation offered to you",
        f"{donation.donor.name} offered '{donation.food_name}' ({donation.servings} servings). Accept it if you can collect.",
        "offer_received",
        donation.id,
    )
    db.session.commit()
    return collection_request


def user_is_responder(collection_request, user):
    """The party who did NOT create the request is the one who accepts or rejects it."""
    if collection_request.initiated_by == "ngo":
        return user.id == collection_request.donation.donor_id
    return collection_request.ngo is not None and user.id == collection_request.ngo.user_id


def accept_collection_request(collection_request, acting_user, note=None, now=None):
    now = now or utc_now()
    donation = collection_request.donation

    if not user_is_responder(collection_request, acting_user):
        raise ApiError("You are not allowed to accept this request.", 403, "FORBIDDEN")
    if collection_request.status != REQUEST_PENDING:
        raise ApiError(f"This request is already {collection_request.status}.", 409, "REQUEST_NOT_PENDING")
    if donation.pickup_deadline <= now or donation.expires_at <= now:
        raise ApiError("This donation's pickup time has passed.", 409, "DONATION_EXPIRED")
    if get_available_capacity(collection_request.ngo) < donation.servings:
        raise ApiError("The NGO no longer has enough capacity for this donation.", 422, "CAPACITY_EXCEEDED")

    # ---- Atomic claim: only succeeds if nobody else has claimed the donation ----
    result = db.session.execute(
        update(Donation)
        .where(
            Donation.id == donation.id,
            Donation.status == STATUS_REQUESTED,
            Donation.assigned_ngo_id.is_(None),
        )
        .values(status=STATUS_ACCEPTED, assigned_ngo_id=collection_request.ngo_id, accepted_at=now, updated_at=now)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.session.rollback()
        raise ApiError("This donation has already been claimed by another NGO.", 409, "ALREADY_CLAIMED")
    db.session.refresh(donation)

    add_history_entry(
        donation, STATUS_REQUESTED, STATUS_ACCEPTED, acting_user,
        note or f"Collection by {collection_request.ngo.organization_name} confirmed",
    )
    collection_request.status = REQUEST_ACCEPTED
    collection_request.response_note = note
    collection_request.responded_at = now
    reject_pending_requests(donation, "another NGO was selected for this donation", skip_request_id=collection_request.id, now=now)

    notify_user(
        collection_request.ngo.user_id,
        "Collection confirmed",
        f"You will collect '{donation.food_name}'. Please schedule the pickup before the deadline.",
        "request_accepted",
        donation.id,
    )
    notify_user(
        donation.donor_id,
        "Donation accepted",
        f"{collection_request.ngo.organization_name} will collect '{donation.food_name}'.",
        "request_accepted",
        donation.id,
    )
    db.session.commit()
    return collection_request


def reject_collection_request(collection_request, acting_user, note=None, now=None):
    now = now or utc_now()
    if not user_is_responder(collection_request, acting_user):
        raise ApiError("You are not allowed to reject this request.", 403, "FORBIDDEN")
    if collection_request.status != REQUEST_PENDING:
        raise ApiError(f"This request is already {collection_request.status}.", 409, "REQUEST_NOT_PENDING")
    _close_request(collection_request, REQUEST_REJECTED, acting_user, note, now)

    donation = collection_request.donation
    if collection_request.initiated_by == "ngo":
        notify_user(
            collection_request.ngo.user_id, "Request rejected",
            f"The donor rejected your request for '{donation.food_name}'." + (f" Note: {note}" if note else ""),
            "request_rejected", donation.id,
        )
    else:
        notify_user(
            donation.donor_id, "Offer declined",
            f"{collection_request.ngo.organization_name} declined '{donation.food_name}'." + (f" Note: {note}" if note else ""),
            "request_rejected", donation.id,
        )
    db.session.commit()
    return collection_request


def withdraw_collection_request(collection_request, acting_user, now=None):
    """The party who CREATED the request can withdraw it while it is pending."""
    now = now or utc_now()
    is_creator = (
        (collection_request.initiated_by == "ngo" and collection_request.ngo.user_id == acting_user.id)
        or (collection_request.initiated_by == "donor" and collection_request.donation.donor_id == acting_user.id)
    )
    if not is_creator:
        raise ApiError("Only the creator of a request can withdraw it.", 403, "FORBIDDEN")
    if collection_request.status != REQUEST_PENDING:
        raise ApiError(f"This request is already {collection_request.status}.", 409, "REQUEST_NOT_PENDING")
    _close_request(collection_request, REQUEST_WITHDRAWN, acting_user, "Withdrawn", now)
    db.session.commit()
    return collection_request


def _close_request(collection_request, new_request_status, acting_user, note, now):
    """Close a request; if no pending requests remain, the donation becomes AVAILABLE again."""
    collection_request.status = new_request_status
    collection_request.response_note = note
    collection_request.responded_at = now
    donation = collection_request.donation
    if donation.status == STATUS_REQUESTED and not has_pending_requests(donation):
        change_status(donation, STATUS_AVAILABLE, acting_user, "No pending requests - open to NGOs again", now)
