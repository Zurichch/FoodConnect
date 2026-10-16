"""
User model - one row per person who can log in (donor, NGO representative or admin).

Passwords are never stored as plain text. We store a one-way "hash" made by
Werkzeug; at login we hash the typed password again and compare the results.
"""
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..utils.time_utils import to_iso, utc_now


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint("role IN ('donor', 'ngo', 'admin')", name="ck_users_role"),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, index=True)

    phone = db.Column(db.String(30))
    address = db.Column(db.String(255))
    area = db.Column(db.String(100))          # neighbourhood / locality, e.g. "Adyar"
    postal_code = db.Column(db.String(10))
    donor_type = db.Column(db.String(30))     # restaurant, hotel, canteen ... (donors only)

    is_suspended = db.Column(db.Boolean, nullable=False, default=False)
    suspension_reason = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(db.DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # One-to-one: an NGO user has exactly one NGOProfile (uselist=False means "not a list").
    ngo_profile = db.relationship("NGOProfile", back_populates="user", uselist=False)
    # One-to-many: a donor can create many donations.
    donations = db.relationship("Donation", back_populates="donor")

    def set_password(self, plain_password):
        self.password_hash = generate_password_hash(plain_password)

    def check_password(self, plain_password):
        return check_password_hash(self.password_hash, plain_password)

    def to_dict(self):
        """Convert to JSON-friendly dict. NOTE: password_hash is deliberately left out."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "phone": self.phone,
            "address": self.address,
            "area": self.area,
            "postal_code": self.postal_code,
            "donor_type": self.donor_type,
            "is_suspended": self.is_suspended,
            "suspension_reason": self.suspension_reason,
            "created_at": to_iso(self.created_at),
            "ngo_profile_id": self.ngo_profile.id if self.ngo_profile else None,
        }
