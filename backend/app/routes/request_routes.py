"""
request_routes.py - Collection requests between NGOs and donors.

  POST /api/donations/<id>/requests      NGO asks to collect a donation
  POST /api/donations/<id>/offer         donor offers a donation to a recommended NGO
  GET  /api/requests/incoming            requests waiting for MY decision
  GET  /api/requests/sent                requests I created
  POST /api/requests/<id>/accept         accept (the atomic claim happens here)
  POST /api/requests/<id>/reject         reject
  POST /api/requests/<id>/withdraw       creator cancels a pending request

The rules themselves live in services/collection_service.py; these routes
only read the input, check who is calling, and call the service.
"""
from flask import Blueprint, request

from ..extensions import db
from ..models import CollectionRequest, Donation, NGOProfile
from ..services import collection_service
from ..services.lifecycle import expire_overdue_donations
from ..utils.auth_helpers import auth_required, current_ngo_profile, current_user
from ..utils.constants import REQUEST_PENDING
from ..utils.responses import ApiError, paginate_query, success_response
from ..utils.validators import get_json_body, raise_if_errors, read_int, read_pagination, read_string

request_bp = Blueprint("requests", __name__, url_prefix="/api")


def get_request_or_404(request_id):
    collection_request = db.session.get(CollectionRequest, request_id)
    if collection_request is None:
        raise ApiError("Request not found.", 404, "NOT_FOUND")
    return collection_request


def get_donation_or_404(donation_id):
    donation = db.session.get(Donation, donation_id)
    if donation is None:
        raise ApiError("Donation not found.", 404, "NOT_FOUND")
    return donation


@request_bp.post("/donations/<int:donation_id>/requests")
@auth_required("ngo")
def ngo_request_donation(donation_id):
    expire_overdue_donations()
    donation = get_donation_or_404(donation_id)
    ngo = current_ngo_profile()
    if not ngo.is_verified:
        raise ApiError("Your NGO must be verified by an administrator before requesting donations.", 403, "NGO_NOT_VERIFIED")
    message = read_string(get_json_body(), "message", {}, max_length=500)
    created = collection_service.create_ngo_request(donation, ngo, current_user(), message)
    return success_response(created.to_dict(), "Collection request sent to the donor.", 201)


@request_bp.post("/donations/<int:donation_id>/offer")
@auth_required("donor")
def donor_offer_donation(donation_id):
    expire_overdue_donations()
    donation = get_donation_or_404(donation_id)
    donor = current_user()
    if donation.donor_id != donor.id:
        raise ApiError("You can only offer your own donations.", 403, "FORBIDDEN")
    data = get_json_body()
    errors = {}
    ngo_id = read_int(data, "ngo_id", errors, required=True)
    raise_if_errors(errors)
    ngo = db.session.get(NGOProfile, ngo_id)
    if ngo is None:
        raise ApiError("NGO not found.", 404, "NOT_FOUND")
    created = collection_service.create_donor_offer(donation, ngo, donor, read_string(data, "message", {}, max_length=500))
    return success_response(created.to_dict(), f"Donation offered to {ngo.organization_name}.", 201)


@request_bp.get("/requests/incoming")
@auth_required("donor", "ngo")
def incoming_requests():
    """Requests where the logged-in user must decide (accept/reject)."""
    expire_overdue_donations()
    user = current_user()
    page, per_page = read_pagination()
    if user.role == "donor":
        query = CollectionRequest.query.join(Donation).filter(
            Donation.donor_id == user.id, CollectionRequest.initiated_by == "ngo"
        )
    else:
        query = CollectionRequest.query.filter(
            CollectionRequest.ngo_id == current_ngo_profile().id, CollectionRequest.initiated_by == "donor"
        )
    if request.args.get("status", "pending") != "all":
        query = query.filter(CollectionRequest.status == request.args.get("status", REQUEST_PENDING))
    query = query.order_by(CollectionRequest.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda r: r.to_dict()))


@request_bp.get("/requests/sent")
@auth_required("donor", "ngo")
def sent_requests():
    """Requests the logged-in user created (NGO requests, or donor offers)."""
    user = current_user()
    page, per_page = read_pagination()
    if user.role == "donor":
        query = CollectionRequest.query.join(Donation).filter(
            Donation.donor_id == user.id, CollectionRequest.initiated_by == "donor"
        )
    else:
        query = CollectionRequest.query.filter(
            CollectionRequest.ngo_id == current_ngo_profile().id, CollectionRequest.initiated_by == "ngo"
        )
    status = request.args.get("status", "all")
    if status != "all":
        query = query.filter(CollectionRequest.status == status)
    query = query.order_by(CollectionRequest.created_at.desc())
    return success_response(paginate_query(query, page, per_page, lambda r: r.to_dict()))


@request_bp.post("/requests/<int:request_id>/accept")
@auth_required("donor", "ngo")
def accept_request(request_id):
    expire_overdue_donations()
    collection_request = get_request_or_404(request_id)
    note = read_string(get_json_body(), "note", {}, max_length=500)
    collection_service.accept_collection_request(collection_request, current_user(), note)
    return success_response(collection_request.to_dict(), "Request accepted. The donation is now reserved for this NGO.")


@request_bp.post("/requests/<int:request_id>/reject")
@auth_required("donor", "ngo")
def reject_request(request_id):
    collection_request = get_request_or_404(request_id)
    note = read_string(get_json_body(), "note", {}, max_length=500)
    collection_service.reject_collection_request(collection_request, current_user(), note)
    return success_response(collection_request.to_dict(), "Request rejected.")


@request_bp.post("/requests/<int:request_id>/withdraw")
@auth_required("donor", "ngo")
def withdraw_request(request_id):
    collection_request = get_request_or_404(request_id)
    collection_service.withdraw_collection_request(collection_request, current_user())
    return success_response(collection_request.to_dict(), "Request withdrawn.")
