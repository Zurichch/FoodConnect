"""
geo.py - Map locations for donations (used by the "Donations map" pages).

Where does a donation's map position come from?
  1. EXACT: the donor can drop a pin on the map in the donation form
     (stored as pickup_latitude / pickup_longitude).
  2. APPROXIMATE: otherwise we use the centre of the pickup area (or PIN code)
     from the small built-in table below. No paid geocoding API is needed.

Privacy rule (same as for the street address):
  * the donor, the assigned NGO and admins may see the EXACT pin;
  * every other NGO only sees an APPROXIMATE position (area centre), so
    nobody can find the donor's exact door before the donor accepts them.

The table covers the Chennai areas used in the demo. Unknown areas without a
pin simply do not appear on the map ("not mapped" count).
Matching (matching.py) is still area-based; it does not use these coordinates.
"""
import math

DEFAULT_CENTER = {"lat": 13.0500, "lng": 80.2400}  # central Chennai

# Approximate centre of each area: (latitude, longitude)
AREA_COORDINATES = {
    "adyar": (13.0012, 80.2565),
    "besant nagar": (12.9990, 80.2707),
    "thiruvanmiyur": (12.9830, 80.2594),
    "mylapore": (13.0368, 80.2676),
    "t. nagar": (13.0418, 80.2341),
    "t nagar": (13.0418, 80.2341),
    "kodambakkam": (13.0521, 80.2255),
    "saidapet": (13.0213, 80.2231),
    "west mambalam": (13.0377, 80.2215),
    "velachery": (12.9815, 80.2180),
    "guindy": (13.0067, 80.2206),
    "tambaram": (12.9249, 80.1000),
    "taramani": (12.9863, 80.2432),
    "anna nagar": (13.0850, 80.2101),
    "kilpauk": (13.0827, 80.2420),
    "aminjikarai": (13.0710, 80.2240),
    "royapettah": (13.0540, 80.2640),
    "alwarpet": (13.0339, 80.2550),
    "egmore": (13.0732, 80.2609),
    "nungambakkam": (13.0569, 80.2425),
    "porur": (13.0382, 80.1565),
    "chromepet": (12.9516, 80.1462),
    "perambur": (13.1210, 80.2330),
}

# Fallback when the area name is not in the table: PIN code -> area
POSTAL_CODE_AREAS = {
    "600020": "adyar", "600090": "besant nagar", "600041": "thiruvanmiyur", "600004": "mylapore",
    "600017": "t. nagar", "600024": "kodambakkam", "600015": "saidapet", "600033": "west mambalam",
    "600042": "velachery", "600032": "guindy", "600045": "tambaram", "600113": "taramani",
    "600040": "anna nagar", "600010": "kilpauk", "600029": "aminjikarai", "600014": "royapettah",
    "600018": "alwarpet", "600008": "egmore", "600034": "nungambakkam", "600116": "porur",
    "600044": "chromepet", "600011": "perambur",
}

APPROXIMATE_RADIUS_METERS = 800  # how big the "somewhere around here" circle is drawn


def normalize(text):
    return " ".join(str(text or "").lower().split())


def area_center(area=None, postal_code=None):
    """Centre of an area by name, falling back to its PIN code. Returns (lat, lng) or None."""
    name = normalize(area)
    if name in AREA_COORDINATES:
        return AREA_COORDINATES[name]
    area_from_pin = POSTAL_CODE_AREAS.get(str(postal_code or "").strip())
    if area_from_pin:
        return AREA_COORDINATES[area_from_pin]
    return None


def spread(lat, lng, seed):
    """
    Move a point by a few hundred metres in a fixed direction based on `seed`
    (the donation id), so several donations in the same area do not sit exactly
    on top of each other. Same id -> same position every time.
    """
    angle = math.radians((seed * 137.5) % 360)  # "golden angle" spreads points evenly
    distance = 0.002 + 0.0015 * (seed % 3)     # roughly 200-500 m
    return round(lat + distance * math.cos(angle), 6), round(lng + distance * math.sin(angle), 6)


def donation_location(donation, exact_allowed):
    """
    Where to draw this donation on a map, or None if we cannot place it.
    Returns {"lat", "lng", "precision": "exact" | "approximate"}.
    """
    has_pin = donation.pickup_latitude is not None and donation.pickup_longitude is not None
    if exact_allowed and has_pin:
        return {"lat": donation.pickup_latitude, "lng": donation.pickup_longitude, "precision": "exact"}

    center = area_center(donation.pickup_area, donation.pickup_postal_code)
    if center:
        lat, lng = spread(center[0], center[1], donation.id or 0)
        return {"lat": lat, "lng": lng, "precision": "approximate"}
    if has_pin:
        # Unknown area: round the pin to ~1 km so it is not exact.
        return {"lat": round(donation.pickup_latitude, 2), "lng": round(donation.pickup_longitude, 2), "precision": "approximate"}
    return None


def ngo_base_location(ngo):
    """Approximate base of an NGO: centre of its first known service area."""
    for area in ngo.service_area_list():
        center = area_center(area)
        if center:
            return {"lat": center[0], "lng": center[1], "label": area}
    for postal_code in ngo.postal_code_list():
        center = area_center(None, postal_code)
        if center:
            return {"lat": center[0], "lng": center[1], "label": postal_code}
    return None
