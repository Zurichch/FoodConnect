"""
DonationStatusHistory model - an append-only record of every status change.

Each row answers: which donation, from which status, to which status,
when, who made the change, and an optional note. The tracking timeline on the
donation details page is drawn directly from these rows.
"""
from ..extensions import db
from ..utils.time_utils import to_iso, utc_now


class DonationStatusHistory(db.Model):
    __tablename__ = "donation_status_history"

    id = db.Column(db.Integer, primary_key=True)
    donation_id = db.Column(db.Integer, db.ForeignKey("donations.id"), nullable=False, index=True)
    old_status = db.Column(db.String(20))  # empty for the very first "created" entry
    new_status = db.Column(db.String(20), nullable=False)
    changed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))  # empty = automatic system change
    note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    donation = db.relationship("Donation", back_populates="status_history")
    changed_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "donation_id": self.donation_id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "changed_by_id": self.changed_by_id,
            "changed_by_name": self.changed_by.name if self.changed_by else "System",
            "changed_by_role": self.changed_by.role if self.changed_by else "system",
            "note": self.note,
            "created_at": to_iso(self.created_at),
        }
