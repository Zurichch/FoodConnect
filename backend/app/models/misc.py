"""
Smaller supporting models:

  DonationReport  - a user flags a donation as suspicious/unsafe; admins review it.
  ContactMessage  - messages sent from the public Contact page; admins read them.
  TokenBlocklist  - login tokens that were logged out, so they cannot be reused.
"""
from ..extensions import db
from ..utils.constants import REPORT_OPEN
from ..utils.time_utils import to_iso, utc_now


class DonationReport(db.Model):
    __tablename__ = "donation_reports"

    id = db.Column(db.Integer, primary_key=True)
    donation_id = db.Column(db.Integer, db.ForeignKey("donations.id"), nullable=False, index=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=REPORT_OPEN, index=True)
    resolution_note = db.Column(db.String(500))
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    resolved_at = db.Column(db.DateTime)

    donation = db.relationship("Donation")
    reporter = db.relationship("User", foreign_keys=[reporter_id])

    def to_dict(self):
        return {
            "id": self.id,
            "donation_id": self.donation_id,
            "donation_name": self.donation.food_name if self.donation else None,
            "donation_status": self.donation.status if self.donation else None,
            "reporter_id": self.reporter_id,
            "reporter_name": self.reporter.name if self.reporter else None,
            "reason": self.reason,
            "status": self.status,
            "resolution_note": self.resolution_note,
            "created_at": to_iso(self.created_at),
            "resolved_at": to_iso(self.resolved_at),
        }


class ContactMessage(db.Model):
    __tablename__ = "contact_messages"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "subject": self.subject,
            "message": self.message,
            "created_at": to_iso(self.created_at),
        }


class TokenBlocklist(db.Model):
    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), nullable=False, unique=True, index=True)  # unique token id
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
