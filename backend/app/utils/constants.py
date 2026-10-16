"""
constants.py - Fixed lists of allowed values.

Keeping them in one place means the validation code, the matching
algorithm and the seed script all agree on the same spellings.
"""

# ---- User roles ----
ROLE_DONOR = "donor"
ROLE_NGO = "ngo"
ROLE_ADMIN = "admin"
ALL_ROLES = [ROLE_DONOR, ROLE_NGO, ROLE_ADMIN]
SELF_REGISTER_ROLES = [ROLE_DONOR, ROLE_NGO]  # nobody can register as admin

DONOR_TYPES = [
    "restaurant", "hotel", "canteen", "bakery", "supermarket", "caterer", "individual", "other",
]

# ---- Food details ----
FOOD_CATEGORIES = [
    "cooked_meals", "bakery", "fruits_vegetables", "dairy", "packaged_food", "beverages", "other",
]
DIETARY_TYPES = ["vegetarian", "non_vegetarian", "vegan"]
STORAGE_TYPES = ["room_temperature", "refrigerated", "frozen"]
QUANTITY_UNITS = ["kg", "litres", "portions", "packets", "trays", "boxes"]

# What an NGO is able / willing to accept
NGO_DIETARY_PREFERENCES = ["any", "prefers_vegetarian", "vegetarian_only", "vegan_only"]

# ---- Donation statuses (the rules for moving between them are in services/lifecycle.py) ----
STATUS_AVAILABLE = "AVAILABLE"
STATUS_REQUESTED = "REQUESTED"
STATUS_ACCEPTED = "ACCEPTED"
STATUS_PICKUP_SCHEDULED = "PICKUP_SCHEDULED"
STATUS_COLLECTED = "COLLECTED"
STATUS_DELIVERED = "DELIVERED"
STATUS_CANCELLED = "CANCELLED"
STATUS_EXPIRED = "EXPIRED"
STATUS_REJECTED = "REJECTED"
ALL_DONATION_STATUSES = [
    STATUS_AVAILABLE, STATUS_REQUESTED, STATUS_ACCEPTED, STATUS_PICKUP_SCHEDULED,
    STATUS_COLLECTED, STATUS_DELIVERED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_REJECTED,
]

# ---- NGO verification ----
VERIFICATION_PENDING = "pending"
VERIFICATION_VERIFIED = "verified"
VERIFICATION_REJECTED = "rejected"

# ---- Collection requests ----
REQUEST_PENDING = "pending"
REQUEST_ACCEPTED = "accepted"
REQUEST_REJECTED = "rejected"
REQUEST_WITHDRAWN = "withdrawn"

# ---- Donation reports (moderation) ----
REPORT_OPEN = "open"
REPORT_RESOLVED = "resolved"
REPORT_DISMISSED = "dismissed"
