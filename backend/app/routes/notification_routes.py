"""
notification_routes.py - Read and mark the logged-in user's notifications.
A user can only ever see or change their own notifications.
"""
from flask import Blueprint, request

from ..extensions import db
from ..models import Notification
from ..utils.auth_helpers import auth_required, current_user
from ..utils.responses import ApiError, paginate_query, success_response
from ..utils.validators import read_pagination

notification_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notification_bp.get("")
@auth_required()
def list_notifications():
    page, per_page = read_pagination()
    query = Notification.query.filter_by(user_id=current_user().id)
    if request.args.get("unread") == "true":
        query = query.filter_by(is_read=False)
    query = query.order_by(Notification.created_at.desc(), Notification.id.desc())
    return success_response(paginate_query(query, page, per_page, lambda n: n.to_dict()))


@notification_bp.get("/unread-count")
@auth_required()
def unread_count():
    count = Notification.query.filter_by(user_id=current_user().id, is_read=False).count()
    return success_response({"unread": count})


@notification_bp.post("/<int:notification_id>/read")
@auth_required()
def mark_read(notification_id):
    notification = db.session.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user().id:
        raise ApiError("Notification not found.", 404, "NOT_FOUND")
    notification.is_read = True
    db.session.commit()
    return success_response(notification.to_dict(), "Marked as read.")


@notification_bp.post("/read-all")
@auth_required()
def mark_all_read():
    updated = Notification.query.filter_by(user_id=current_user().id, is_read=False).update({"is_read": True})
    db.session.commit()
    return success_response({"updated": updated}, "All notifications marked as read.")
