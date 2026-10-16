"""
analytics_routes.py - Dashboard statistics (all computed from the database
by services/analytics.py) and the public endpoints used by the landing page.
"""
from flask import Blueprint

from ..extensions import db
from ..models import ContactMessage
from ..services.analytics import admin_analytics, donor_analytics, ngo_analytics, public_stats
from ..services.lifecycle import expire_overdue_donations
from ..services.matching import WEIGHTS
from ..utils.auth_helpers import auth_required, current_ngo_profile, current_user
from ..utils.responses import success_response
from ..utils.validators import get_json_body, raise_if_errors, read_string, validate_email

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api")


@analytics_bp.get("/analytics/admin")
@auth_required("admin")
def analytics_for_admin():
    expire_overdue_donations()
    return success_response(admin_analytics())


@analytics_bp.get("/analytics/donor")
@auth_required("donor")
def analytics_for_donor():
    expire_overdue_donations()
    return success_response(donor_analytics(current_user().id))


@analytics_bp.get("/analytics/ngo")
@auth_required("ngo")
def analytics_for_ngo():
    expire_overdue_donations()
    return success_response(ngo_analytics(current_ngo_profile()))


# ------------------------------------------------------------------ public (no login)
@analytics_bp.get("/health")
def health():
    return success_response({"status": "ok"}, "FoodConnect API is running.")


@analytics_bp.get("/public/stats")
def stats_for_landing_page():
    data = public_stats()
    data["matching_weights"] = WEIGHTS
    return success_response(data)


@analytics_bp.post("/public/contact")
def contact():
    data = get_json_body()
    errors = {}
    name = read_string(data, "name", errors, required=True, max_length=120)
    email = read_string(data, "email", errors, required=True, max_length=120)
    subject = read_string(data, "subject", errors, required=True, max_length=150)
    message = read_string(data, "message", errors, required=True, max_length=3000)
    validate_email(email, errors)
    raise_if_errors(errors)
    db.session.add(ContactMessage(name=name, email=email, subject=subject, message=message))
    db.session.commit()
    return success_response(None, "Thank you! Your message has been sent to the FoodConnect team.", 201)
