"""
lifecycle.py - The rules for how a donation's status may change.

Normal path:
    AVAILABLE -> REQUESTED -> ACCEPTED -> PICKUP_SCHEDULED -> COLLECTED -> DELIVERED

Other outcomes:
    CANCELLED  (donor cancels before collection)
    EXPIRED    (pickup deadline / use-by time passed before collection - set automatically)
    REJECTED   (an admin removes the donation during moderation)

ALLOWED_TRANSITIONS below is the single source of truth. Any change that is
not listed is refused by the backend, whatever the frontend sends.
"""
import json

from ..extensions import db
from ..models import CollectionRequest, Donation, DonationStatusHistory
from ..utils.constants import (
    REQUEST_PENDING,
    REQUEST_REJECTED,
    STATUS_ACCEPTED,
    STATUS_AVAILABLE,
    STATUS_CANCELLED,
    STATUS_COLLECTED,
    STATUS_DELIVERED,
    STATUS_EXPIRED,
    STATUS_PICKUP_SCHEDULED,
    STATUS_REJECTED,
    STATUS_REQUESTED,
)
from ..utils.responses import ApiError
from ..utils.time_utils import utc_now
from .notification_service import notify_user

# status -> set of statuses it may move to next
ALLOWED_TRANSITIONS = {
    STATUS_AVAILABLE: {STATUS_REQUESTED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_REJECTED},
    STATUS_REQUESTED: {STATUS_AVAILABLE, STATUS_ACCEPTED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_REJECTED},
    STATUS_ACCEPTED: {STATUS_PICKUP_SCHEDULED, STATUS_CANCELLED, STATUS_EXPIRED},
    STATUS_PICKUP_SCHEDULED: {STATUS_COLLECTED, STATUS_CANCELLED, STATUS_EXPIRED},
    STATUS_COLLECTED: {STATUS_DELIVERED},
    # Final statuses: nothing can follow them.
    STATUS_DELIVERED: set(),
    STATUS_CANCELLED: set(),
    STATUS_EXPIRED: set(),
    STATUS_REJECTED: set(),
}

# The order used to draw the progress timeline in the frontend.
NORMAL_FLOW = [
    STATUS_AVAILABLE, STATUS_REQUESTED, STATUS_ACCEPTED,
    STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED, STATUS_DELIVERED,
]

# Groups of statuses used by queries and permission checks.
OPEN_FOR_REQUESTS = {STATUS_AVAILABLE, STATUS_REQUESTED}            # NGOs may still ask for it
IN_PROGRESS = {STATUS_ACCEPTED, STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED}
FINAL_STATUSES = {STATUS_DELIVERED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_REJECTED}
CANCELLABLE_BY_DONOR = {STATUS_AVAILABLE, STATUS_REQUESTED, STATUS_ACCEPTED, STATUS_PICKUP_SCHEDULED}
# Statuses the ASSIGNED NGO may set through the status-update endpoint.
NGO_UPDATABLE_STATUSES = {STATUS_PICKUP_SCHEDULED, STATUS_COLLECTED, STATUS_DELIVERED}


def can_transition(old_status, new_status):
    return new_status in ALLOWED_TRANSITIONS.get(old_status, set())


def add_history_entry(donation, old_status, new_status, changed_by=None, note=None):
    entry = DonationStatusHistory(
        donation=donation,
        old_status=old_status,
        new_status=new_status,
        changed_by_id=changed_by.id if changed_by else None,
        note=note,
        created_at=utc_now(),
    )
    db.session.add(entry)
    return entry


def change_status(donation, new_status, changed_by=None, note=None, now=None):
    """
    Move a donation to a new status after checking the transition is allowed.
    Also records the change in the status history. The caller must commit.
    """
    now = now or utc_now()
    old_status = donation.status
    if not can_transition(old_status, new_status):
        raise ApiError(
            f"A donation cannot move from {old_status} to {new_status}.",
            409,
            "INVALID_STATUS_TRANSITION",
            {"current_status": old_status, "allowed_next": sorted(ALLOWED_TRANSITIONS.get(old_status, []))},
        )
    donation.status = new_status
    donation.updated_at = now
    if new_status == STATUS_ACCEPTED:
        donation.accepted_at = now
    elif new_status == STATUS_COLLECTED:
        donation.collected_at = now
    elif new_status == STATUS_DELIVERED:
        donation.delivered_at = now
    add_history_entry(donation, old_status, new_status, changed_by, note)
    return donation


def reject_pending_requests(donation, note, skip_request_id=None, now=None):
    """Mark every still-pending request for this donation as rejected and tell those NGOs."""
    now = now or utc_now()
    for collection_request in donation.requests:
        if collection_request.status == REQUEST_PENDING and collection_request.id != skip_request_id:
            collection_request.status = REQUEST_REJECTED
            collection_request.response_note = note
            collection_request.responded_at = now
            notify_user(
                collection_request.ngo.user_id,
                "Request closed",
                f"Your request for '{donation.food_name}' was closed: {note}",
                "request_rejected",
                donation.id,
            )


def expire_overdue_donations(now=None):
    """
    Mark donations EXPIRED when time has run out. Called at the start of list
    endpoints ("lazy" expiry) so no background scheduler is needed.

      * AVAILABLE / REQUESTED -> expire once the pickup deadline has passed.
      * ACCEPTED / PICKUP_SCHEDULED -> expire once the declared use-by time has
        passed without the food being collected (it is no longer safe to collect).
    Returns the number of donations expired.
    """
    now = now or utc_now()
    waiting = Donation.query.filter(
        Donation.status.in_(OPEN_FOR_REQUESTS), Donation.pickup_deadline <= now
    ).all()
    not_collected = Donation.query.filter(
        Donation.status.in_([STATUS_ACCEPTED, STATUS_PICKUP_SCHEDULED]), Donation.expires_at <= now
    ).all()

    for donation in waiting + not_collected:
        change_status(donation, STATUS_EXPIRED, None, "Expired automatically: time limit passed before collection.", now)
        reject_pending_requests(donation, "the donation expired", now=now)
        notify_user(
            donation.donor_id,
            "Donation expired",
            f"'{donation.food_name}' expired before it could be collected.",
            "donation_expired",
            donation.id,
        )
        if donation.assigned_ngo:
            notify_user(
                donation.assigned_ngo.user_id,
                "Donation expired",
                f"'{donation.food_name}' expired before collection and must not be picked up.",
                "donation_expired",
                donation.id,
            )
    if waiting or not_collected:
        db.session.commit()
    return len(waiting) + len(not_collected)


def has_pending_requests(donation):
    return any(r.status == REQUEST_PENDING for r in donation.requests)


def pending_requests_query(donation_id):
    return CollectionRequest.query.filter_by(donation_id=donation_id, status=REQUEST_PENDING)


def safety_warnings_to_json(warnings):
    return json.dumps(warnings or [])
