"""
AuditLog model - a permanent record of important administrative actions
(verifying an NGO, suspending a user, moderating a donation ...).

Admins can read this log but there is no API to edit or delete it.
"""
from ..extensions import db
from ..utils.time_utils import to_iso, utc_now


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(60), nullable=False, index=True)    # e.g. "NGO_VERIFIED"
    target_type = db.Column(db.String(40), nullable=False)           # e.g. "ngo_profile"
    target_id = db.Column(db.Integer)
    details = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)

    actor = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "actor_name": self.actor.name if self.actor else "System",
            "action": self.action,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "created_at": to_iso(self.created_at),
        }
