"""
time_utils.py - Small helpers for dates and times.

Rule used everywhere in FoodConnect:
  * The database stores times in UTC (without timezone info).
  * The API sends times as ISO strings ending in "Z" (meaning UTC),
    e.g. "2026-10-15T14:30:00Z".
  * The browser converts them to the user's local time for display.
"""
from datetime import datetime, timezone


def utc_now():
    """Current time in UTC, as a 'naive' datetime (the format SQLite stores)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_datetime(value):
    """
    Convert an ISO date-time string into a UTC datetime.

    Returns None for empty values. Raises ValueError if the text is not a valid date.
    Times without a timezone are treated as UTC.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def to_iso(value):
    """Convert a stored UTC datetime into an ISO string ending with 'Z' (or None)."""
    if value is None:
        return None
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def hours_between(start, end):
    """Number of hours from start to end (negative if end is before start)."""
    return (end - start).total_seconds() / 3600
