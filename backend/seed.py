"""
seed.py - Fills the LOCAL demo database with realistic sample data.

    python seed.py

WARNING: this deletes and recreates every table in the configured database,
so it is safe to run again and again (it always produces the same demo state,
with times relative to "now"). It refuses to run when APP_ENV=production.

Demo passwords come from backend/.env (DEMO_ADMIN_PASSWORD, DEMO_USER_PASSWORD).
They are for local demonstrations only - never reuse them anywhere real.
"""
import os
import sys
from datetime import timedelta

from app import create_app
from app.extensions import db
from app.models import (
    AuditLog,
    CollectionRequest,
    ContactMessage,
    Donation,
    DonationReport,
    DonationStatusHistory,
    NGOProfile,
    Notification,
    User,
)
from app.services.food_safety import check_food_safety
from app.services.lifecycle import NORMAL_FLOW, safety_warnings_to_json
from app.utils.time_utils import utc_now

NOW = utc_now()


def hours(value):
    return timedelta(hours=value)


def days(value):
    return timedelta(days=value)


def require_env(name):
    value = os.getenv(name)
    if not value:
        sys.exit(f"ERROR: {name} is not set. Copy backend/.env.example to backend/.env and try again.")
    return value


# ------------------------------------------------------------------ users
def create_user(name, email, role, password, **extra):
    user = User(name=name, email=email.lower(), role=role, **extra)
    user.set_password(password)
    db.session.add(user)
    return user


def create_ngo(user, organization_name, verification_status="verified", **extra):
    profile = NGOProfile(
        user=user,
        organization_name=organization_name,
        contact_phone=user.phone,
        contact_email=user.email,
        address=user.address,
        verification_status=verification_status,
        verified_at=NOW - days(120) if verification_status == "verified" else None,
        created_at=NOW - days(150),
        **extra,
    )
    db.session.add(profile)
    return profile


# ------------------------------------------------------------------ donations
STATUS_NOTES = {
    "AVAILABLE": "Donation created and passed safety checks",
    "REQUESTED": "Collection requested",
    "ACCEPTED": "Collection confirmed",
    "PICKUP_SCHEDULED": "Pickup scheduled",
    "COLLECTED": "Food collected from donor",
    "DELIVERED": "Food distributed to beneficiaries",
}

NOTIFICATION_TEXT = {
    "REQUESTED": ("donor", "New collection request", "{ngo} wants to collect '{food}'."),
    "ACCEPTED": ("ngo", "Collection confirmed", "You will collect '{food}'."),
    "PICKUP_SCHEDULED": ("donor", "Pickup scheduled", "{ngo} scheduled pickup of '{food}'. Please keep it ready for collection."),
    "COLLECTED": ("donor", "Donation collected", "{ngo} has collected '{food}'."),
    "DELIVERED": ("donor", "Donation delivered", "'{food}' reached people in need."),
}


# Exact demo map pins (latitude, longitude) for each donor's pickup address in Chennai.
DONOR_MAP_PINS = {
    "restaurant@foodconnect.demo": (13.0063, 80.2574),  # LB Road, Adyar
    "hotel@foodconnect.demo": (13.0405, 80.2337),       # Usman Road, T. Nagar
    "canteen@foodconnect.demo": (12.9791, 80.2209),     # 100 Feet Road, Velachery
    "bakery@foodconnect.demo": (13.0862, 80.2090),      # 2nd Avenue, Anna Nagar
    "priya@foodconnect.demo": (13.0339, 80.2697),       # Kutchery Road, Mylapore
}


def create_donation(donor, created_ago, final_status, ngo=None, request_by="ngo", outcome_note=None, **fields):
    """
    Build a donation plus its status history, collection request and notifications.
    created_ago: how long ago the donation was created (timedelta).
    """
    created_at = NOW - created_ago
    # Every demo donor has a map pin at their own address (used by the Donations map).
    latitude, longitude = DONOR_MAP_PINS[donor.email]
    donation = Donation(donor=donor, created_at=created_at, updated_at=created_at, safety_declaration=True,
                        pickup_latitude=latitude, pickup_longitude=longitude, **fields)
    # Run the real safety checker (as if "now" were the creation time) to store warnings.
    safety = check_food_safety(fields | {"safety_declaration": True}, created_at)
    donation.safety_warnings = safety_warnings_to_json(safety["warnings"])
    db.session.add(donation)
    db.session.flush()  # assigns donation.id so notifications can link to it

    # Which statuses did this donation go through?
    if final_status in NORMAL_FLOW:
        path = NORMAL_FLOW[: NORMAL_FLOW.index(final_status) + 1]
    else:
        reached = {"CANCELLED": "REQUESTED", "EXPIRED": "AVAILABLE", "REJECTED": "AVAILABLE"}[final_status]
        path = NORMAL_FLOW[: NORMAL_FLOW.index(reached) + 1] + [final_status]

    # Spread the status changes between creation and "now" so no timestamp is in the future.
    step_gap = min(timedelta(minutes=35), (NOW - created_at) / len(path))
    step_time = created_at
    old_status = None
    for status in path:
        actor = donor
        if status in ("PICKUP_SCHEDULED", "COLLECTED", "DELIVERED") and ngo:
            actor = ngo.user
        if status == "REQUESTED" and ngo and request_by == "ngo":
            actor = ngo.user
        if status in ("EXPIRED",):
            actor = None
        if status == "REJECTED":
            actor = ADMIN
        note = outcome_note if status in ("CANCELLED", "EXPIRED", "REJECTED") else STATUS_NOTES.get(status)
        if status == "REQUESTED" and ngo:
            note = f"Collection requested by {ngo.organization_name}" if request_by == "ngo" else f"Offered to {ngo.organization_name}"
        db.session.add(DonationStatusHistory(
            donation=donation, old_status=old_status, new_status=status,
            changed_by_id=actor.id if actor else None, note=note, created_at=step_time,
        ))
        if status in NOTIFICATION_TEXT and ngo:
            who, title, text = NOTIFICATION_TEXT[status]
            if status == "REQUESTED" and request_by == "donor":
                who, title, text = "ngo", "Donation offered to you", "{food_owner} offered '{food}'. Accept it if you can collect."
            target = donor if who == "donor" else ngo.user
            db.session.add(Notification(
                user_id=target.id, title=title,
                message=text.format(ngo=ngo.organization_name, food=donation.food_name, food_owner=donor.name),
                notification_type=status.lower(), donation_id=donation.id, is_read=created_ago > days(2),
                created_at=step_time,
            ))
        if status == "ACCEPTED":
            donation.accepted_at = step_time
        if status == "PICKUP_SCHEDULED":
            donation.scheduled_pickup_at = step_time + hours(1)
        if status == "COLLECTED":
            donation.collected_at = step_time
        if status == "DELIVERED":
            donation.delivered_at = step_time
            donation.servings_distributed = donation.servings
        old_status = status
        step_time = step_time + step_gap

    donation.status = final_status
    donation.updated_at = step_time - step_gap
    if final_status in ("CANCELLED", "REJECTED"):
        donation.cancel_reason = outcome_note

    if ngo:
        accepted = final_status in NORMAL_FLOW[2:]
        if accepted:
            donation.assigned_ngo = ngo
        db.session.add(CollectionRequest(
            donation=donation, ngo=ngo, initiated_by=request_by,
            status="accepted" if accepted else ("pending" if final_status == "REQUESTED" else "rejected"),
            message="We can collect within the hour." if request_by == "ngo" else "Your NGO is our top match.",
            response_note=None if final_status in NORMAL_FLOW else "the donor cancelled the donation",
            match_score=88, created_at=created_at + step_gap,
            responded_at=None if final_status == "REQUESTED" else created_at + 2 * step_gap,
        ))
    return donation


ADMIN = None


def seed():
    global ADMIN
    db.drop_all()
    db.create_all()

    admin_email = require_env("DEMO_ADMIN_EMAIL")
    admin_password = require_env("DEMO_ADMIN_PASSWORD")
    user_password = require_env("DEMO_USER_PASSWORD")

    # ---------------- Admin
    ADMIN = create_user("FoodConnect Admin", admin_email, "admin", admin_password,
                        phone="+91 90000 00000", area="Guindy", postal_code="600032", address="Platform Office, Guindy, Chennai")

    # ---------------- Donors
    restaurant = create_user("Annapoorna Restaurant", "restaurant@foodconnect.demo", "donor", user_password,
                             donor_type="restaurant", phone="+91 98400 11111", area="Adyar", postal_code="600020",
                             address="12 LB Road, Adyar, Chennai", created_at=NOW - days(160))
    hotel = create_user("Hotel Grand Residency", "hotel@foodconnect.demo", "donor", user_password,
                        donor_type="hotel", phone="+91 98400 22222", area="T. Nagar", postal_code="600017",
                        address="45 Usman Road, T. Nagar, Chennai", created_at=NOW - days(150))
    canteen = create_user("Velachery College Canteen", "canteen@foodconnect.demo", "donor", user_password,
                          donor_type="canteen", phone="+91 98400 33333", area="Velachery", postal_code="600042",
                          address="Main Block, 100 Feet Road, Velachery, Chennai", created_at=NOW - days(140))
    bakery = create_user("Sweet Crust Bakery", "bakery@foodconnect.demo", "donor", user_password,
                         donor_type="bakery", phone="+91 98400 44444", area="Anna Nagar", postal_code="600040",
                         address="2nd Avenue, Anna Nagar, Chennai", created_at=NOW - days(135))
    individual = create_user("Priya Raman", "priya@foodconnect.demo", "donor", user_password,
                             donor_type="individual", phone="+91 98400 55555", area="Mylapore", postal_code="600004",
                             address="8 Kutchery Road, Mylapore, Chennai", created_at=NOW - days(60))

    # ---------------- NGOs
    def ngo_user(name, email, area, postal, phone, address):
        return create_user(name, email, "ngo", user_password, phone=phone, area=area, postal_code=postal,
                           address=address, created_at=NOW - days(150))

    helping_hands = create_ngo(
        ngo_user("Ravi Kumar", "helpinghands@foodconnect.demo", "Adyar", "600020", "+91 94440 10001", "3 Gandhi Nagar, Adyar, Chennai"),
        "Helping Hands Food Bank", registration_number="TN/NGO/2019/0412",
        description="Community food bank serving daily-wage workers and night shelters in South Chennai.",
        service_areas="Adyar,Besant Nagar,Thiruvanmiyur,Mylapore", postal_codes="600020,600090,600041,600004",
        max_capacity_servings=300, pickup_lead_time_minutes=45, preferred_categories="cooked_meals,bakery,fruits_vegetables",
        dietary_preference="any", can_store_refrigerated=True, can_store_frozen=False, accepts_unpackaged=True,
        opening_time="07:00", closing_time="22:00",
    )
    annadhanam = create_ngo(
        ngo_user("Lakshmi Narayanan", "annadhanam@foodconnect.demo", "T. Nagar", "600017", "+91 94440 10002", "21 Ranganathan St, T. Nagar, Chennai"),
        "Annadhanam Trust", registration_number="TN/NGO/2015/0098",
        description="Temple-linked trust providing vegetarian meals to elderly people and pilgrims.",
        service_areas="T. Nagar,Kodambakkam,Saidapet,West Mambalam", postal_codes="600017,600024,600015,600033",
        max_capacity_servings=150, pickup_lead_time_minutes=60, preferred_categories="cooked_meals",
        dietary_preference="vegetarian_only", can_store_refrigerated=False, can_store_frozen=False, accepts_unpackaged=True,
        opening_time="06:00", closing_time="20:00",
    )
    green_plate = create_ngo(
        ngo_user("Arjun Mehta", "greenplate@foodconnect.demo", "Velachery", "600042", "+91 94440 10003", "Plot 7, Taramani Link Rd, Velachery, Chennai"),
        "Green Plate Shelter", registration_number="TN/NGO/2020/0731",
        description="Shelter for homeless families with cold storage for packaged and dairy food.",
        service_areas="Velachery,Guindy,Tambaram,Taramani", postal_codes="600042,600032,600045,600113",
        max_capacity_servings=120, pickup_lead_time_minutes=30, preferred_categories="packaged_food,bakery,dairy,beverages",
        dietary_preference="any", can_store_refrigerated=True, can_store_frozen=True, accepts_unpackaged=False,
        opening_time="08:00", closing_time="21:00",
    )
    anna_nagar_kitchen = create_ngo(
        ngo_user("Fatima Begum", "annanagar@foodconnect.demo", "Anna Nagar", "600040", "+91 94440 10004", "14 Shanthi Colony, Anna Nagar, Chennai"),
        "Anna Nagar Community Kitchen", registration_number="TN/NGO/2017/0256",
        description="Community kitchen that redistributes meals to students and migrant workers.",
        service_areas="Anna Nagar,Kilpauk,Aminjikarai", postal_codes="600040,600010,600029",
        max_capacity_servings=200, pickup_lead_time_minutes=60, preferred_categories="",
        dietary_preference="prefers_vegetarian", can_store_refrigerated=True, can_store_frozen=False, accepts_unpackaged=True,
        opening_time="08:00", closing_time="22:00",
    )
    create_ngo(
        ngo_user("Joseph Daniel", "littlelights@foodconnect.demo", "Mylapore", "600004", "+91 94440 10005", "5 Luz Church Rd, Mylapore, Chennai"),
        "Little Lights Children's Home", verification_status="pending", registration_number="TN/NGO/2024/1102",
        description="Children's home requesting verification to receive meal donations.",
        service_areas="Mylapore,Royapettah,Alwarpet", postal_codes="600004,600014,600018",
        max_capacity_servings=80, pickup_lead_time_minutes=40, preferred_categories="cooked_meals,dairy,fruits_vegetables",
        dietary_preference="any", can_store_refrigerated=True, accepts_unpackaged=True,
    )
    db.session.flush()  # gives every row an id so we can link to it

    # ---------------- Donations: completed history (spread over months for the trend chart)
    def past_times(created_ago, shelf_hours=8):
        start = NOW - created_ago
        return {"prepared_at": start - hours(1), "expires_at": start + hours(shelf_hours), "pickup_deadline": start + hours(shelf_hours - 2)}

    create_donation(bakery, days(130), "DELIVERED", anna_nagar_kitchen, food_name="Assorted pastries and buns", category="bakery",
                    quantity=6, quantity_unit="trays", servings=60, dietary_type="vegetarian", is_packaged=True,
                    storage_type="room_temperature", allergens="gluten, dairy", pickup_address=bakery.address,
                    pickup_area="Anna Nagar", pickup_postal_code="600040", **past_times(days(130), 24))
    create_donation(restaurant, days(100), "DELIVERED", helping_hands, food_name="Lemon rice and curd rice", category="cooked_meals",
                    quantity=14, quantity_unit="kg", servings=55, dietary_type="vegetarian", is_packaged=False,
                    storage_type="room_temperature", allergens="dairy", pickup_address=restaurant.address,
                    pickup_area="Adyar", pickup_postal_code="600020", **past_times(days(100), 5))
    create_donation(restaurant, days(75), "DELIVERED", helping_hands, food_name="Vegetable biryani", category="cooked_meals",
                    quantity=10, quantity_unit="kg", servings=40, dietary_type="vegetarian", is_packaged=False,
                    storage_type="room_temperature", allergens="nuts", pickup_address=restaurant.address,
                    pickup_area="Adyar", pickup_postal_code="600020", **past_times(days(75), 5))
    create_donation(hotel, days(50), "DELIVERED", annadhanam, food_name="Chapati and dal tadka", category="cooked_meals",
                    quantity=60, quantity_unit="portions", servings=60, dietary_type="vegetarian", is_packaged=False,
                    storage_type="room_temperature", allergens="gluten", pickup_address=hotel.address,
                    pickup_area="T. Nagar", pickup_postal_code="600017", **past_times(days(50), 5))
    create_donation(bakery, days(35), "DELIVERED", anna_nagar_kitchen, food_name="Whole wheat bread loaves", category="bakery",
                    quantity=30, quantity_unit="packets", servings=90, dietary_type="vegan", is_packaged=True,
                    storage_type="room_temperature", allergens="gluten", pickup_address=bakery.address,
                    pickup_area="Anna Nagar", pickup_postal_code="600040", **past_times(days(35), 30))
    create_donation(canteen, days(20), "DELIVERED", green_plate, food_name="Packaged fruit juice", category="beverages",
                    quantity=48, quantity_unit="packets", servings=48, dietary_type="vegan", is_packaged=True,
                    storage_type="room_temperature", allergens=None, pickup_address=canteen.address,
                    pickup_area="Velachery", pickup_postal_code="600042", **past_times(days(20), 48))

    # ---------------- Other outcomes
    create_donation(hotel, days(10), "CANCELLED", annadhanam, outcome_note="Event food was used by the hotel staff canteen instead",
                    food_name="Paneer pulao (event surplus)", category="cooked_meals", quantity=8, quantity_unit="kg",
                    servings=35, dietary_type="vegetarian", is_packaged=False, storage_type="room_temperature",
                    allergens="dairy", pickup_address=hotel.address, pickup_area="T. Nagar", pickup_postal_code="600017",
                    **past_times(days(10), 6))
    create_donation(individual, days(5), "EXPIRED", None, outcome_note="Expired automatically: time limit passed before collection.",
                    food_name="Cut fruit platter", category="fruits_vegetables", quantity=3, quantity_unit="kg",
                    servings=20, dietary_type="vegan", is_packaged=False, storage_type="refrigerated", allergens=None,
                    pickup_address=individual.address, pickup_area="Mylapore", pickup_postal_code="600004",
                    **past_times(days(5), 6))
    rejected = create_donation(hotel, days(3), "REJECTED", None, outcome_note="Report #1: no preparation details and unlabelled containers",
                               food_name="Unlabelled leftover containers", category="other", quantity=5, quantity_unit="boxes",
                               servings=15, dietary_type="non_vegetarian", is_packaged=False, storage_type="room_temperature",
                               allergens=None, pickup_address=hotel.address, pickup_area="T. Nagar",
                               pickup_postal_code="600017", **past_times(days(3), 6))

    # ---------------- In progress today
    create_donation(restaurant, hours(3), "COLLECTED", helping_hands, food_name="Sambar rice and poriyal", category="cooked_meals",
                    quantity=12, quantity_unit="kg", servings=50, dietary_type="vegetarian", is_packaged=False,
                    storage_type="room_temperature", allergens=None, pickup_address=restaurant.address,
                    pickup_area="Adyar", pickup_postal_code="600020",
                    prepared_at=NOW - hours(4), expires_at=NOW + hours(3), pickup_deadline=NOW + hours(1))
    create_donation(hotel, hours(2), "PICKUP_SCHEDULED", annadhanam, food_name="Paneer butter masala with rotis",
                    category="cooked_meals", quantity=45, quantity_unit="portions", servings=45, dietary_type="vegetarian",
                    is_packaged=True, storage_type="room_temperature", allergens="dairy, gluten",
                    pickup_address=hotel.address, pickup_area="T. Nagar", pickup_postal_code="600017",
                    prepared_at=NOW - hours(2.5), expires_at=NOW + hours(4), pickup_deadline=NOW + hours(2.5))
    create_donation(bakery, hours(1.5), "ACCEPTED", anna_nagar_kitchen, food_name="Chocolate cupcakes", category="bakery",
                    quantity=2, quantity_unit="boxes", servings=24, dietary_type="vegetarian", is_packaged=True,
                    storage_type="room_temperature", allergens="gluten, dairy, eggs-free", pickup_address=bakery.address,
                    pickup_area="Anna Nagar", pickup_postal_code="600040",
                    prepared_at=NOW - hours(5), expires_at=NOW + hours(20), pickup_deadline=NOW + hours(8))
    create_donation(canteen, hours(1), "REQUESTED", green_plate, food_name="Veg pulao meal boxes", category="cooked_meals",
                    quantity=80, quantity_unit="boxes", servings=80, dietary_type="vegetarian", is_packaged=True,
                    storage_type="room_temperature", allergens=None, pickup_address=canteen.address,
                    pickup_area="Velachery", pickup_postal_code="600042",
                    prepared_at=NOW - hours(1.5), expires_at=NOW + hours(5), pickup_deadline=NOW + hours(3.5))
    create_donation(individual, hours(0.5), "REQUESTED", helping_hands, request_by="donor", food_name="Egg fried rice",
                    category="cooked_meals", quantity=6, quantity_unit="kg", servings=25, dietary_type="non_vegetarian",
                    is_packaged=False, storage_type="room_temperature", allergens="eggs, soy", pickup_address=individual.address,
                    pickup_area="Mylapore", pickup_postal_code="600004",
                    prepared_at=NOW - hours(1), expires_at=NOW + hours(5), pickup_deadline=NOW + hours(3))

    # ---------------- Open donations ready for the live matching demo
    create_donation(restaurant, hours(0.4), "AVAILABLE", None, food_name="Idli, vada and coconut chutney", category="cooked_meals",
                    quantity=30, quantity_unit="portions", servings=30, dietary_type="vegetarian", is_packaged=False,
                    storage_type="room_temperature", allergens=None, pickup_address=restaurant.address,
                    pickup_area="Adyar", pickup_postal_code="600020", notes="Please bring your own containers.",
                    prepared_at=NOW - hours(1), expires_at=NOW + hours(6), pickup_deadline=NOW + hours(4.5))
    milk = create_donation(canteen, hours(0.3), "AVAILABLE", None, food_name="Toned milk packets", category="dairy",
                           quantity=25, quantity_unit="litres", servings=50, dietary_type="vegetarian", is_packaged=True,
                           storage_type="refrigerated", allergens="dairy", pickup_address=canteen.address,
                           pickup_area="Velachery", pickup_postal_code="600042",
                           prepared_at=NOW - hours(2), expires_at=NOW + hours(30), pickup_deadline=NOW + hours(6))
    create_donation(individual, hours(0.2), "AVAILABLE", None, food_name="Fresh vegetables (tomato, beans, carrots)",
                    category="fruits_vegetables", quantity=15, quantity_unit="kg", servings=40, dietary_type="vegan",
                    is_packaged=False, storage_type="room_temperature", allergens=None, pickup_address=individual.address,
                    pickup_area="Mylapore", pickup_postal_code="600004",
                    prepared_at=NOW - hours(3), expires_at=NOW + hours(48), pickup_deadline=NOW + hours(20))
    db.session.flush()

    # ---------------- Reports, contact message and audit trail
    db.session.add(DonationReport(donation=rejected, reporter_id=annadhanam.user_id,
                                  reason="Containers had no labels and the donor could not say when the food was cooked.",
                                  status="resolved", resolution_note="Donation removed - insufficient safety information.",
                                  resolved_by_id=ADMIN.id, created_at=NOW - days(3) + hours(2), resolved_at=NOW - days(3) + hours(4)))
    db.session.add(DonationReport(donation=milk, reporter_id=helping_hands.user_id,
                                  reason="Please confirm the milk packets were kept refrigerated all day.",
                                  status="open", created_at=NOW - hours(0.1)))
    db.session.add(ContactMessage(name="Meena S", email="meena@example.com", subject="Partnering as a caterer",
                                  message="We cater weddings in Chennai and often have surplus food. How can we join?",
                                  created_at=NOW - days(2)))
    for profile in (helping_hands, annadhanam, green_plate, anna_nagar_kitchen):
        db.session.add(AuditLog(actor_id=ADMIN.id, action="NGO_VERIFIED", target_type="ngo_profile", target_id=profile.id,
                                details=f"{profile.organization_name}: registration documents checked", created_at=NOW - days(120)))
    db.session.add(AuditLog(actor_id=ADMIN.id, action="DONATION_REJECTED", target_type="donation", target_id=rejected.id,
                            details="Unlabelled containers with no preparation time", created_at=NOW - days(3) + hours(4)))
    db.session.add(AuditLog(actor_id=ADMIN.id, action="REPORT_RESOLVED", target_type="donation_report", target_id=1,
                            details="Donation removed - insufficient safety information.", created_at=NOW - days(3) + hours(4)))
    db.session.add(Notification(user_id=ADMIN.id, title="New NGO awaiting verification",
                                message="Little Lights Children's Home registered and needs verification.",
                                notification_type="admin", created_at=NOW - days(1)))
    db.session.add(Notification(user_id=ADMIN.id, title="Donation reported",
                                message="'Toned milk packets' was reported: please confirm refrigeration.",
                                notification_type="report", donation_id=milk.id, created_at=NOW - hours(0.1)))

    db.session.commit()


def print_credentials():
    user_password = os.getenv("DEMO_USER_PASSWORD")
    print("\nDemo data created. DEMO ACCOUNTS (local use only - change them in backend/.env):")
    print(f"  Admin : {os.getenv('DEMO_ADMIN_EMAIL')} / {os.getenv('DEMO_ADMIN_PASSWORD')}")
    print(f"  Donor : restaurant@foodconnect.demo / {user_password}  (also hotel@, canteen@, bakery@, priya@)")
    print(f"  NGO   : helpinghands@foodconnect.demo / {user_password}  (also annadhanam@, greenplate@, annanagar@)")
    print(f"  NGO (pending verification): littlelights@foodconnect.demo / {user_password}")
    print(f"\nTotals: {User.query.count()} users, {NGOProfile.query.count()} NGOs, {Donation.query.count()} donations, "
          f"{CollectionRequest.query.count()} requests, {Notification.query.count()} notifications.")


if __name__ == "__main__":
    if os.getenv("APP_ENV", "development") == "production":
        sys.exit("Refusing to seed: APP_ENV is 'production'. Seeding deletes all data.")
    app = create_app()
    with app.app_context():
        seed()
        print_credentials()
