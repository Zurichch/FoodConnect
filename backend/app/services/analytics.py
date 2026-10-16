"""
analytics.py - Dashboard numbers, calculated from real database rows.

FORMULAS (also documented in the README):
  total_donations        = number of donation rows
  available_donations    = donations with status AVAILABLE or REQUESTED
  awaiting_collection    = donations with status ACCEPTED or PICKUP_SCHEDULED
  completed_donations    = donations with status DELIVERED
  servings_recovered     = sum of servings of COLLECTED + DELIVERED donations
                           (food that actually left the donor with an NGO)
  completion_rate (%)    = DELIVERED / closed donations x 100
                           closed = DELIVERED + CANCELLED + EXPIRED + REJECTED
                           (donations still in progress are not counted either way)

ILLUSTRATIVE ESTIMATES (clearly labelled as estimates in the UI - NOT measured):
  estimated_food_kg      = servings_recovered x 0.4 kg per serving
  estimated_co2e_kg      = estimated_food_kg x 2.5 kg CO2e per kg of food
FoodConnect does not weigh food, so these are rough illustrations only.
"""
from collections import Counter, OrderedDict
from datetime import timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import CollectionRequest, Donation, NGOProfile, User
from ..utils.constants import (
    STATUS_ACCEPTED,
    STATUS_AVAILABLE,
    STATUS_CANCELLED,
    STATUS_COLLECTED,
    STATUS_DELIVERED,
    STATUS_EXPIRED,
    STATUS_PICKUP_SCHEDULED,
    STATUS_REJECTED,
    STATUS_REQUESTED,
    VERIFICATION_PENDING,
    VERIFICATION_VERIFIED,
)
from ..utils.time_utils import utc_now

ESTIMATED_KG_PER_SERVING = 0.4
ESTIMATED_CO2E_PER_KG_FOOD = 2.5
CLOSED_STATUSES = [STATUS_DELIVERED, STATUS_CANCELLED, STATUS_EXPIRED, STATUS_REJECTED]


def _base_query(donor_id=None, ngo_id=None):
    query = Donation.query
    if donor_id is not None:
        query = query.filter(Donation.donor_id == donor_id)
    if ngo_id is not None:
        query = query.filter(Donation.assigned_ngo_id == ngo_id)
    return query


def count_by_status(donor_id=None, ngo_id=None):
    query = db.session.query(Donation.status, func.count(Donation.id))
    if donor_id is not None:
        query = query.filter(Donation.donor_id == donor_id)
    if ngo_id is not None:
        query = query.filter(Donation.assigned_ngo_id == ngo_id)
    counts = dict(query.group_by(Donation.status).all())
    return counts


def sum_servings(statuses, donor_id=None, ngo_id=None):
    query = db.session.query(func.coalesce(func.sum(Donation.servings), 0)).filter(Donation.status.in_(statuses))
    if donor_id is not None:
        query = query.filter(Donation.donor_id == donor_id)
    if ngo_id is not None:
        query = query.filter(Donation.assigned_ngo_id == ngo_id)
    return int(query.scalar())


def estimate_impact(servings):
    food_kg = round(servings * ESTIMATED_KG_PER_SERVING, 1)
    return {
        "estimated_food_kg": food_kg,
        "estimated_co2e_kg": round(food_kg * ESTIMATED_CO2E_PER_KG_FOOD, 1),
        "is_estimate": True,
        "assumptions": (
            f"Illustrative only: {ESTIMATED_KG_PER_SERVING} kg per serving and "
            f"{ESTIMATED_CO2E_PER_KG_FOOD} kg CO2e per kg of food. Food is not weighed."
        ),
    }


def build_summary(donor_id=None, ngo_id=None):
    counts = count_by_status(donor_id, ngo_id)
    total = sum(counts.values())
    delivered = counts.get(STATUS_DELIVERED, 0)
    closed = sum(counts.get(s, 0) for s in CLOSED_STATUSES)
    servings_recovered = sum_servings([STATUS_COLLECTED, STATUS_DELIVERED], donor_id, ngo_id)
    return {
        "total_donations": total,
        "available_donations": counts.get(STATUS_AVAILABLE, 0) + counts.get(STATUS_REQUESTED, 0),
        "awaiting_collection": counts.get(STATUS_ACCEPTED, 0) + counts.get(STATUS_PICKUP_SCHEDULED, 0),
        "collected_not_delivered": counts.get(STATUS_COLLECTED, 0),
        "completed_donations": delivered,
        "cancelled_donations": counts.get(STATUS_CANCELLED, 0),
        "expired_donations": counts.get(STATUS_EXPIRED, 0),
        "rejected_donations": counts.get(STATUS_REJECTED, 0),
        "servings_recovered": servings_recovered,
        "completion_rate": round(delivered / closed * 100, 1) if closed else 0.0,
        "status_counts": counts,
        "impact_estimate": estimate_impact(servings_recovered),
    }


def monthly_trends(months=6, donor_id=None, ngo_id=None, now=None):
    """Donations created and delivered per month for the last `months` months."""
    now = now or utc_now()
    buckets = OrderedDict()
    year, month = now.year, now.month
    for _ in range(months):
        buckets[f"{year:04d}-{month:02d}"] = {"month": f"{year:04d}-{month:02d}", "created": 0, "delivered": 0, "servings": 0}
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    buckets = OrderedDict(reversed(list(buckets.items())))

    start = now - timedelta(days=31 * months)
    for donation in _base_query(donor_id, ngo_id).filter(Donation.created_at >= start).all():
        key = donation.created_at.strftime("%Y-%m")
        if key in buckets:
            buckets[key]["created"] += 1
            if donation.status == STATUS_DELIVERED:
                buckets[key]["delivered"] += 1
                buckets[key]["servings"] += donation.servings
    return list(buckets.values())


def category_breakdown(donor_id=None, ngo_id=None):
    counter = Counter()
    servings = Counter()
    for donation in _base_query(donor_id, ngo_id).all():
        counter[donation.category] += 1
        servings[donation.category] += donation.servings
    return [
        {"category": category, "donations": count, "servings": servings[category]}
        for category, count in counter.most_common()
    ]


def ngo_activity():
    """For each verified NGO: how many donations it collected and how many servings."""
    rows = []
    for ngo in NGOProfile.query.order_by(NGOProfile.organization_name).all():
        handled = Donation.query.filter(
            Donation.assigned_ngo_id == ngo.id, Donation.status.in_([STATUS_COLLECTED, STATUS_DELIVERED])
        ).all()
        rows.append({
            "ngo_id": ngo.id,
            "organization_name": ngo.organization_name,
            "verification_status": ngo.verification_status,
            "collections": len(handled),
            "servings_collected": sum(d.servings for d in handled),
            "requests_made": CollectionRequest.query.filter_by(ngo_id=ngo.id).count(),
        })
    rows.sort(key=lambda r: (-r["servings_collected"], r["organization_name"]))
    return rows


def admin_analytics(now=None):
    return {
        "summary": build_summary(),
        "users": {
            "donors": User.query.filter_by(role="donor").count(),
            "ngos": User.query.filter_by(role="ngo").count(),
            "admins": User.query.filter_by(role="admin").count(),
            "suspended": User.query.filter_by(is_suspended=True).count(),
            "verified_ngos": NGOProfile.query.filter_by(verification_status=VERIFICATION_VERIFIED).count(),
            "pending_ngos": NGOProfile.query.filter_by(verification_status=VERIFICATION_PENDING).count(),
        },
        "monthly_trends": monthly_trends(now=now),
        "categories": category_breakdown(),
        "ngo_activity": ngo_activity(),
    }


def donor_analytics(donor_id, now=None):
    return {
        "summary": build_summary(donor_id=donor_id),
        "monthly_trends": monthly_trends(donor_id=donor_id, now=now),
        "categories": category_breakdown(donor_id=donor_id),
    }


def ngo_analytics(ngo, now=None):
    summary = build_summary(ngo_id=ngo.id)
    delivered = Donation.query.filter_by(assigned_ngo_id=ngo.id, status=STATUS_DELIVERED).all()
    summary["servings_received"] = sum_servings([STATUS_COLLECTED, STATUS_DELIVERED], ngo_id=ngo.id)
    summary["servings_distributed"] = sum((d.servings_distributed or d.servings) for d in delivered)
    pending = CollectionRequest.query.filter_by(ngo_id=ngo.id, status="pending")
    summary["pending_requests"] = pending.filter_by(initiated_by="ngo").count()  # waiting for donors
    summary["pending_offers"] = pending.filter_by(initiated_by="donor").count()  # waiting for this NGO
    return {
        "summary": summary,
        "monthly_trends": monthly_trends(ngo_id=ngo.id, now=now),
        "categories": category_breakdown(ngo_id=ngo.id),
    }


def public_stats():
    """Numbers shown on the public landing page."""
    summary = build_summary()
    return {
        "completed_donations": summary["completed_donations"],
        "servings_recovered": summary["servings_recovered"],
        "total_donations": summary["total_donations"],
        "verified_ngos": NGOProfile.query.filter_by(verification_status=VERIFICATION_VERIFIED).count(),
        "active_donors": User.query.filter_by(role="donor", is_suspended=False).count(),
        "impact_estimate": summary["impact_estimate"],
    }
