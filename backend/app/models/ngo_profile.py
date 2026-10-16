"""
NGOProfile model - organisation details for a user whose role is "ngo".

The matching algorithm (services/matching.py) reads these fields:
  service_areas, postal_codes      -> location score
  max_capacity_servings            -> capacity score
  preferred_categories             -> category score
  dietary_preference               -> dietary score / exclusion
  pickup_lead_time_minutes         -> deadline feasibility
  can_store_refrigerated / frozen, accepts_unpackaged -> handling exclusions

Lists (areas, postal codes, categories) are stored as simple comma-separated
text, e.g. "Adyar,Besant Nagar". This keeps the schema easy to understand.
A larger system would use separate linked tables instead.
"""
from ..extensions import db
from ..utils.constants import VERIFICATION_PENDING, VERIFICATION_VERIFIED
from ..utils.time_utils import to_iso, utc_now


def split_csv(text):
    """'a, b,c' -> ['a', 'b', 'c']"""
    return [item.strip() for item in (text or "").split(",") if item.strip()]


class NGOProfile(db.Model):
    __tablename__ = "ngo_profiles"
    __table_args__ = (
        db.CheckConstraint("max_capacity_servings >= 0", name="ck_ngo_capacity_positive"),
        db.CheckConstraint(
            "verification_status IN ('pending', 'verified', 'rejected')", name="ck_ngo_verification"
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    # unique=True -> one profile per user (this is what makes the relationship one-to-one)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)

    organization_name = db.Column(db.String(150), nullable=False)
    registration_number = db.Column(db.String(60))
    description = db.Column(db.Text)
    address = db.Column(db.String(255))
    service_areas = db.Column(db.Text, nullable=False, default="")   # "Adyar,Besant Nagar"
    postal_codes = db.Column(db.Text, nullable=False, default="")    # "600020,600090"
    contact_phone = db.Column(db.String(30))
    contact_email = db.Column(db.String(120))
    opening_time = db.Column(db.String(5), default="09:00")
    closing_time = db.Column(db.String(5), default="21:00")

    max_capacity_servings = db.Column(db.Integer, nullable=False, default=100)
    pickup_lead_time_minutes = db.Column(db.Integer, nullable=False, default=60)
    preferred_categories = db.Column(db.Text, nullable=False, default="")  # empty = accepts all
    dietary_preference = db.Column(db.String(30), nullable=False, default="any")
    can_store_refrigerated = db.Column(db.Boolean, nullable=False, default=False)
    can_store_frozen = db.Column(db.Boolean, nullable=False, default=False)
    accepts_unpackaged = db.Column(db.Boolean, nullable=False, default=True)

    verification_status = db.Column(db.String(20), nullable=False, default=VERIFICATION_PENDING, index=True)
    verification_note = db.Column(db.String(255))
    verified_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    user = db.relationship("User", back_populates="ngo_profile")

    # Helper methods turn the comma-separated text back into Python lists.
    def service_area_list(self):
        return split_csv(self.service_areas)

    def postal_code_list(self):
        return split_csv(self.postal_codes)

    def preferred_category_list(self):
        return split_csv(self.preferred_categories)

    @property
    def is_verified(self):
        return self.verification_status == VERIFICATION_VERIFIED

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization_name": self.organization_name,
            "registration_number": self.registration_number,
            "description": self.description,
            "address": self.address,
            "service_areas": self.service_area_list(),
            "postal_codes": self.postal_code_list(),
            "contact_phone": self.contact_phone,
            "contact_email": self.contact_email,
            "opening_time": self.opening_time,
            "closing_time": self.closing_time,
            "max_capacity_servings": self.max_capacity_servings,
            "pickup_lead_time_minutes": self.pickup_lead_time_minutes,
            "preferred_categories": self.preferred_category_list(),
            "dietary_preference": self.dietary_preference,
            "can_store_refrigerated": self.can_store_refrigerated,
            "can_store_frozen": self.can_store_frozen,
            "accepts_unpackaged": self.accepts_unpackaged,
            "verification_status": self.verification_status,
            "verification_note": self.verification_note,
            "verified_at": to_iso(self.verified_at),
            "is_suspended": self.user.is_suspended if self.user else False,
            "created_at": to_iso(self.created_at),
        }

    def to_public_dict(self):
        """Smaller version shown to donors in recommendations."""
        return {
            "id": self.id,
            "organization_name": self.organization_name,
            "service_areas": self.service_area_list(),
            "contact_phone": self.contact_phone,
            "opening_time": self.opening_time,
            "closing_time": self.closing_time,
            "max_capacity_servings": self.max_capacity_servings,
            "dietary_preference": self.dietary_preference,
            "verification_status": self.verification_status,
        }
