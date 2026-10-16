"""
admin_routes.py - Administrator-only endpoints.

EVERY route here uses @auth_required("admin"). Even if someone un-hides an
admin button in the browser, the backend still returns 403 Forbidden for
non-admin tokens. Each important action also writes an AuditLog row.
"""
from flask import Blueprint, request
from sqlalchemy import or_

from ..extensions import db
from ..models import AuditLog, CollectionRequest, ContactMessage, Donation, DonationReport, DonationStatusHistory, NGOProfile, User
from ..services.analytics import admin_analytics
from ..services.lifecycle import ALLOWED_TRANSITIONS, change_status, expire_overdue_donations, reject_pending_requests
from ..services.notification_service import notify_user, record_audit
from ..utils.auth_helpers import auth_required, current_user
from ..utils.constants import (
    ALL_DONATION_STATUSES,
    ALL_ROLES,
    REPORT_DISMISSED,
    REPORT_OPEN,
    REPORT_RESOLVED,
    ROLE_ADMIN,
    STATUS_REJECTED,
    VERIFICATION_PENDING,
    VERIFICATION_REJECTED,
    VERIFICATION_VERIFIED,
)
from ..utils.responses import ApiError, paginate_query, success_response
from ..utils.time_utils import utc_now
from ..utils.validators import get_json_body, raise_if_errors, read_bool, read_choice, read_pagination, read_string

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def get_or_404(model, object_id, label):
    item = db.session.get(model, object_id)
    if item is None:
        raise ApiError(f"{label} not found.", 404, "NOT_FOUND")
    return item


# ------------------------------------------------------------------ dashboard
@admin_bp.get("/dashboard")
@auth_required("admin")
def dashboard():
    expire_overdue_donations()
    data = admin_analytics()
    data["open_reports"] = DonationReport.query.filter_by(status=REPORT_OPEN).count()
    recent = DonationStatusHistory.query.order_by(DonationStatusHistory.created_at.desc()).limit(10).all()
    data["recent_activity"] = [
        dict(h.to_dict(), food_name=h.donation.food_name if h.donation else None) for h in recent
    ]
    return success_response(data)


# ------------------------------------------------------------------ users
@admin_bp.get("/users")
@auth_required("admin")
def list_users():
    page, per_page = read_pagination()
    query = User.query
    role = request.args.get("role")
    if role in ALL_ROLES:
        query = query.filter(User.role == role)
    status = request.args.get("status")
    if status == "suspended":
        query = query.filter(User.is_suspended.is_(True))
    elif status == "active":
        query = query.filter(User.is_suspended.is_(False))
    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    query = query.order_by(User.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda u: u.to_dict()))


@admin_bp.post("/users/<int:user_id>/suspend")
@auth_required("admin")
def suspend_user(user_id):
    admin = current_user()
    user = get_or_404(User, user_id, "User")
    if user.role == ROLE_ADMIN:
        raise ApiError("Administrator accounts cannot be suspended from the dashboard.", 400, "INVALID_ACTION")
    errors = {}
    reason = read_string(get_json_body(), "reason", errors, required=True, max_length=255)
    raise_if_errors(errors)
    user.is_suspended = True
    user.suspension_reason = reason
    record_audit(admin, "USER_SUSPENDED", "user", user.id, f"{user.email}: {reason}")
    db.session.commit()
    return success_response(user.to_dict(), f"{user.name} has been suspended.")


@admin_bp.post("/users/<int:user_id>/reactivate")
@auth_required("admin")
def reactivate_user(user_id):
    admin = current_user()
    user = get_or_404(User, user_id, "User")
    user.is_suspended = False
    user.suspension_reason = None
    record_audit(admin, "USER_REACTIVATED", "user", user.id, user.email)
    notify_user(user.id, "Account reactivated", "Your FoodConnect account has been reactivated.", "account")
    db.session.commit()
    return success_response(user.to_dict(), f"{user.name} has been reactivated.")


# ------------------------------------------------------------------ NGO verification
@admin_bp.get("/ngos")
@auth_required("admin")
def list_ngos():
    page, per_page = read_pagination()
    query = NGOProfile.query
    status = request.args.get("status")
    if status in (VERIFICATION_PENDING, VERIFICATION_VERIFIED, VERIFICATION_REJECTED):
        query = query.filter(NGOProfile.verification_status == status)
    query = query.order_by(NGOProfile.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda n: n.to_dict()))


@admin_bp.post("/ngos/<int:ngo_id>/verify")
@auth_required("admin")
def verify_ngo(ngo_id):
    admin = current_user()
    ngo = get_or_404(NGOProfile, ngo_id, "NGO")
    note = read_string(get_json_body(), "note", {}, max_length=255) or "Verified by administrator"
    ngo.verification_status = VERIFICATION_VERIFIED
    ngo.verification_note = note
    ngo.verified_at = utc_now()
    record_audit(admin, "NGO_VERIFIED", "ngo_profile", ngo.id, f"{ngo.organization_name}: {note}")
    notify_user(ngo.user_id, "NGO verified", "Your organisation is verified. You can now request donations and appear in recommendations.", "verification")
    db.session.commit()
    return success_response(ngo.to_dict(), f"{ngo.organization_name} is now verified.")


@admin_bp.post("/ngos/<int:ngo_id>/reject")
@auth_required("admin")
def reject_ngo(ngo_id):
    admin = current_user()
    ngo = get_or_404(NGOProfile, ngo_id, "NGO")
    errors = {}
    note = read_string(get_json_body(), "note", errors, required=True, max_length=255)
    raise_if_errors(errors)
    ngo.verification_status = VERIFICATION_REJECTED
    ngo.verification_note = note
    ngo.verified_at = None
    record_audit(admin, "NGO_REJECTED", "ngo_profile", ngo.id, f"{ngo.organization_name}: {note}")
    notify_user(ngo.user_id, "Verification rejected", f"Your NGO verification was rejected: {note}", "verification")
    db.session.commit()
    return success_response(ngo.to_dict(), f"{ngo.organization_name} verification rejected.")


# ------------------------------------------------------------------ donations
@admin_bp.get("/donations")
@auth_required("admin")
def list_all_donations():
    expire_overdue_donations()
    page, per_page = read_pagination()
    query = Donation.query
    status = request.args.get("status")
    if status in ALL_DONATION_STATUSES:
        query = query.filter(Donation.status == status)
    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(or_(Donation.food_name.ilike(f"%{search}%"), Donation.pickup_area.ilike(f"%{search}%")))
    query = query.order_by(Donation.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda d: dict(
        d.to_dict(include_private=True), request_count=len(d.requests)
    )))


@admin_bp.post("/donations/<int:donation_id>/reject")
@auth_required("admin")
def moderate_reject_donation(donation_id):
    """Remove an inappropriate donation from the platform (status -> REJECTED)."""
    admin = current_user()
    donation = get_or_404(Donation, donation_id, "Donation")
    errors = {}
    reason = read_string(get_json_body(), "reason", errors, required=True, max_length=255)
    raise_if_errors(errors)
    _reject_donation(admin, donation, reason)
    db.session.commit()
    return success_response(donation.to_dict(include_private=True), "Donation removed by moderation.")


def _reject_donation(admin, donation, reason):
    change_status(donation, STATUS_REJECTED, admin, f"Removed by moderation: {reason}")
    donation.cancel_reason = reason
    reject_pending_requests(donation, "the donation was removed by an administrator")
    notify_user(donation.donor_id, "Donation removed", f"'{donation.food_name}' was removed by an administrator: {reason}", "moderation", donation.id)
    record_audit(admin, "DONATION_REJECTED", "donation", donation.id, reason)


@admin_bp.get("/requests")
@auth_required("admin")
def list_all_requests():
    page, per_page = read_pagination()
    query = CollectionRequest.query
    status = request.args.get("status")
    if status:
        query = query.filter(CollectionRequest.status == status)
    query = query.order_by(CollectionRequest.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda r: r.to_dict()))


# ------------------------------------------------------------------ reports & messages
@admin_bp.get("/reports")
@auth_required("admin")
def list_reports():
    page, per_page = read_pagination()
    query = DonationReport.query
    status = request.args.get("status")
    if status in (REPORT_OPEN, REPORT_RESOLVED, REPORT_DISMISSED):
        query = query.filter(DonationReport.status == status)
    query = query.order_by(DonationReport.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda r: r.to_dict()))


@admin_bp.post("/reports/<int:report_id>/resolve")
@auth_required("admin")
def resolve_report(report_id):
    """Close a report as 'resolved' or 'dismissed'; optionally also remove the donation."""
    admin = current_user()
    report = get_or_404(DonationReport, report_id, "Report")
    if report.status != REPORT_OPEN:
        raise ApiError("This report has already been handled.", 409, "REPORT_CLOSED")
    data = get_json_body()
    errors = {}
    outcome = read_choice(data, "outcome", [REPORT_RESOLVED, REPORT_DISMISSED], errors, required=True)
    note = read_string(data, "note", errors, required=True, max_length=500)
    raise_if_errors(errors)

    if read_bool(data, "reject_donation"):
        if STATUS_REJECTED not in ALLOWED_TRANSITIONS.get(report.donation.status, set()):
            raise ApiError(f"A {report.donation.status} donation can no longer be removed.", 409, "INVALID_STATUS_TRANSITION")
        _reject_donation(admin, report.donation, f"Report #{report.id}: {note}")

    report.status = outcome
    report.resolution_note = note
    report.resolved_by_id = admin.id
    report.resolved_at = utc_now()
    record_audit(admin, f"REPORT_{outcome.upper()}", "donation_report", report.id, note)
    notify_user(report.reporter_id, "Report reviewed", f"Your report about '{report.donation.food_name}' was {outcome}.", "report", report.donation_id)
    db.session.commit()
    return success_response(report.to_dict(), f"Report {outcome}.")


@admin_bp.get("/contact-messages")
@auth_required("admin")
def list_contact_messages():
    page, per_page = read_pagination()
    query = ContactMessage.query.order_by(ContactMessage.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda m: m.to_dict()))


# ------------------------------------------------------------------ audit log
@admin_bp.get("/audit-logs")
@auth_required("admin")
def list_audit_logs():
    page, per_page = read_pagination()
    query = AuditLog.query
    action = request.args.get("action")
    if action:
        query = query.filter(AuditLog.action == action)
    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    return success_response(paginate_query(query, page, per_page, lambda a: a.to_dict()))
