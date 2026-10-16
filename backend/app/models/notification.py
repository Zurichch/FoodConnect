"""
Notification model - in-app messages shown under the bell icon.

Notifications are only created by backend events (a request is made, a
status changes, a donation expires ...) via services/notification_service.py.
The frontend simply polls the API to display them.
"""
from ..extensions import db
from ..utils.time_utils import to_iso, utc_now


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    notification_type = db.Column(db.String(40), nullable=False, default="info")
    donation_id = db.Column(db.Integer, db.ForeignKey("donations.id"))
    is_read = db.Column(db.Boolean, nullable=False, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "notification_type": self.notification_type,
            "donation_id": self.donation_id,
            "is_read": self.is_read,
            "created_at": to_iso(self.created_at),
        }
