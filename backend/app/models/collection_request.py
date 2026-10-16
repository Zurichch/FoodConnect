"""
CollectionRequest model - links one Donation with one NGO that wants to collect it.

It can be created in two ways (see `initiated_by`):
  * "ngo"   - an NGO asks to collect a donation  -> the DONOR accepts or rejects it.
  * "donor" - a donor offers a donation to a recommended NGO -> the NGO accepts or rejects it.

Only ONE request per donation can ever be accepted. The safety check that
enforces this is in services/collection_service.py (accept_collection_request).
"""
from ..extensions import db
from ..utils.constants import REQUEST_PENDING
from ..utils.time_utils import to_iso, utc_now


class CollectionRequest(db.Model):
    __tablename__ = "collection_requests"
    __table_args__ = (
        # The same NGO cannot create two requests for the same donation.
        db.UniqueConstraint("donation_id", "ngo_id", name="uq_request_donation_ngo"),
        db.CheckConstraint("initiated_by IN ('ngo', 'donor')", name="ck_request_initiator"),
    )

    id = db.Column(db.Integer, primary_key=True)
    donation_id = db.Column(db.Integer, db.ForeignKey("donations.id"), nullable=False, index=True)
    ngo_id = db.Column(db.Integer, db.ForeignKey("ngo_profiles.id"), nullable=False, index=True)
    initiated_by = db.Column(db.String(10), nullable=False, default="ngo")
    status = db.Column(db.String(20), nullable=False, default=REQUEST_PENDING, index=True)
    message = db.Column(db.String(500))
    response_note = db.Column(db.String(500))
    match_score = db.Column(db.Integer)  # snapshot of the matching score when the request was made
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    responded_at = db.Column(db.DateTime)

    donation = db.relationship("Donation", back_populates="requests")
    ngo = db.relationship("NGOProfile")

    def to_dict(self, include_donation=True):
        data = {
            "id": self.id,
            "donation_id": self.donation_id,
            "ngo_id": self.ngo_id,
            "ngo_name": self.ngo.organization_name if self.ngo else None,
            "ngo_phone": self.ngo.contact_phone if self.ngo else None,
            "initiated_by": self.initiated_by,
            "status": self.status,
            "message": self.message,
            "response_note": self.response_note,
            "match_score": self.match_score,
            "created_at": to_iso(self.created_at),
            "responded_at": to_iso(self.responded_at),
        }
        if include_donation and self.donation:
            data["donation"] = {
                "id": self.donation.id,
                "food_name": self.donation.food_name,
                "servings": self.donation.servings,
                "status": self.donation.status,
                "pickup_area": self.donation.pickup_area,
                "pickup_deadline": to_iso(self.donation.pickup_deadline),
                "donor_name": self.donation.donor.name if self.donation.donor else None,
            }
        return data
