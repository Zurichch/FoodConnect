"""
notification_service.py - Creates in-app notifications and audit log entries.

These helpers only ADD rows to the database session. The calling code
commits them together with the main change, so either everything is saved
or nothing is (this is called a "transaction").
"""
from ..extensions import db
from ..models import AuditLog, Notification, User
from ..utils.constants import ROLE_ADMIN


def notify_user(user_id, title, message, notification_type="info", donation_id=None):
    if user_id is None:
        return None
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        donation_id=donation_id,
    )
    db.session.add(notification)
    return notification


def notify_admins(title, message, notification_type="admin", donation_id=None):
    admins = User.query.filter_by(role=ROLE_ADMIN, is_suspended=False).all()
    for admin in admins:
        notify_user(admin.id, title, message, notification_type, donation_id)


def record_audit(actor, action, target_type, target_id=None, details=None):
    """Write an audit log row, e.g. record_audit(admin, "USER_SUSPENDED", "user", 7, "spam")."""
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=(details or "")[:500],
    )
    db.session.add(entry)
    return entry
