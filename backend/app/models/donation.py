"""
Donation model - one row per surplus-food donation created by a donor.

Important ideas:
  * `donor_id` links the donation to the logged-in donor who created it.
    The backend always sets it from the login token, never from the form.
  * `quantity` + `quantity_unit` (e.g. 12 kg) and `servings` (e.g. 40 meals)
    are stored separately because they mean different things.
  * `status` follows the lifecycle in services/lifecycle.py.
  * `assigned_ngo_id` is filled once a collection request is accepted.
"""
import json

from ..extensions import db
from ..utils.constants import STATUS_AVAILABLE
from ..utils.time_utils import to_iso, utc_now


class Donation(db.Model):
    __tablename__ = "donations"
    __table_args__ = (
        db.CheckConstraint("servings > 0", name="ck_donation_servings_positive"),
        db.CheckConstraint("quantity > 0", name="ck_donation_quantity_positive"),
        db.Index("ix_donations_status_deadline", "status", "pickup_deadline"),
    )

    id = db.Column(db.Integer, primary_key=True)
    donor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # ---- What food is it? ----
    food_name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(30), nullable=False, index=True)
    description = db.Column(db.Text)
    quantity = db.Column(db.Float, nullable=False)
    quantity_unit = db.Column(db.String(20), nullable=False, default="kg")
    servings = db.Column(db.Integer, nullable=False)
    dietary_type = db.Column(db.String(20), nullable=False)       # vegetarian / non_vegetarian / vegan
    is_packaged = db.Column(db.Boolean, nullable=False, default=False)
    storage_type = db.Column(db.String(30), nullable=False)       # room_temperature / refrigerated / frozen
    allergens = db.Column(db.String(255))

    # ---- Times (all UTC) ----
    prepared_at = db.Column(db.DateTime, nullable=False)          # when cooked / made available
    expires_at = db.Column(db.DateTime, nullable=False)           # declared use-by / expiry
    pickup_deadline = db.Column(db.DateTime, nullable=False)      # latest time NGO may collect

    # ---- Where to collect ----
    pickup_address = db.Column(db.String(255), nullable=False)
    pickup_area = db.Column(db.String(100), nullable=False)
    pickup_postal_code = db.Column(db.String(10), nullable=False)
    # Optional exact map pin chosen by the donor. Only the donor, the assigned NGO
    # and admins see it; other NGOs get an approximate location (see services/geo.py).
    pickup_latitude = db.Column(db.Float)
    pickup_longitude = db.Column(db.Float)
    notes = db.Column(db.Text)

    # ---- Tracking ----
    status = db.Column(db.String(20), nullable=False, default=STATUS_AVAILABLE, index=True)
    assigned_ngo_id = db.Column(db.Integer, db.ForeignKey("ngo_profiles.id"), index=True)
    safety_warnings = db.Column(db.Text, default="[]")  # JSON list of warning strings
    safety_declaration = db.Column(db.Boolean, nullable=False, default=False)
    cancel_reason = db.Column(db.String(255))
    scheduled_pickup_at = db.Column(db.DateTime)
    accepted_at = db.Column(db.DateTime)
    collected_at = db.Column(db.DateTime)
    delivered_at = db.Column(db.DateTime)
    servings_distributed = db.Column(db.Integer)

    created_at = db.Column(db.DateTime, nullable=False, default=utc_now, index=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships let us write donation.donor.name instead of writing a JOIN by hand.
    donor = db.relationship("User", back_populates="donations")
    assigned_ngo = db.relationship("NGOProfile")
    requests = db.relationship(
        "CollectionRequest", back_populates="donation", cascade="all, delete-orphan"
    )
    status_history = db.relationship(
        "DonationStatusHistory",
        back_populates="donation",
        cascade="all, delete-orphan",
        order_by="DonationStatusHistory.created_at",
    )

    def warning_list(self):
        try:
            return json.loads(self.safety_warnings or "[]")
        except ValueError:
            return []

    def to_dict(self, include_private=False):
        """
        include_private=True adds the exact pickup address and donor phone number.
        Routes only pass True to the donor (owner), the assigned NGO and admins,
        so other NGOs browsing donations see just the area and postal code.
        """
        data = {
            "id": self.id,
            "donor_id": self.donor_id,
            "donor_name": self.donor.name if self.donor else None,
            "donor_type": self.donor.donor_type if self.donor else None,
            "food_name": self.food_name,
            "category": self.category,
            "description": self.description,
            "quantity": self.quantity,
            "quantity_unit": self.quantity_unit,
            "servings": self.servings,
            "dietary_type": self.dietary_type,
            "is_packaged": self.is_packaged,
            "storage_type": self.storage_type,
            "allergens": self.allergens,
            "prepared_at": to_iso(self.prepared_at),
            "expires_at": to_iso(self.expires_at),
            "pickup_deadline": to_iso(self.pickup_deadline),
            "pickup_area": self.pickup_area,
            "pickup_postal_code": self.pickup_postal_code,
            "notes": self.notes,
            "status": self.status,
            "assigned_ngo_id": self.assigned_ngo_id,
            "assigned_ngo_name": self.assigned_ngo.organization_name if self.assigned_ngo else None,
            "safety_warnings": self.warning_list(),
            "safety_declaration": self.safety_declaration,
            "cancel_reason": self.cancel_reason,
            "scheduled_pickup_at": to_iso(self.scheduled_pickup_at),
            "accepted_at": to_iso(self.accepted_at),
            "collected_at": to_iso(self.collected_at),
            "delivered_at": to_iso(self.delivered_at),
            "servings_distributed": self.servings_distributed,
            "created_at": to_iso(self.created_at),
            "updated_at": to_iso(self.updated_at),
        }
        if include_private:
            data["pickup_address"] = self.pickup_address
            data["pickup_latitude"] = self.pickup_latitude
            data["pickup_longitude"] = self.pickup_longitude
            data["donor_phone"] = self.donor.phone if self.donor else None
            data["donor_email"] = self.donor.email if self.donor else None
            if self.assigned_ngo:
                data["assigned_ngo_phone"] = self.assigned_ngo.contact_phone
        return data
