"""
validators.py - Reusable input-checking helpers.

Pattern used in the routes:
    errors = {}
    name = read_string(data, "name", errors, required=True)
    ...
    raise_if_errors(errors)
Every helper writes a friendly message into `errors[field]` when the value is bad,
so the frontend can show the message next to the right form field.
"""
import re

from flask import request

from .responses import ApiError
from .time_utils import parse_datetime

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def get_json_body():
    """Return the request JSON as a dict (or raise a 400 error if it is not JSON)."""
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise ApiError("Request body must be a JSON object.", 400, "INVALID_JSON")
    return data


def raise_if_errors(errors, message="Please fix the highlighted fields."):
    if errors:
        raise ApiError(message, 400, "VALIDATION_ERROR", errors)


def read_string(data, field, errors, required=False, max_length=255, default=None):
    value = data.get(field, default)
    if value is None or (isinstance(value, str) and value.strip() == ""):
        if required:
            errors[field] = "This field is required."
        return default
    value = str(value).strip()
    if len(value) > max_length:
        errors[field] = f"Must be at most {max_length} characters."
    return value


def read_choice(data, field, choices, errors, required=False, default=None):
    value = read_string(data, field, errors, required=required, default=default)
    if value is not None and value not in choices:
        errors[field] = f"Must be one of: {', '.join(choices)}."
    return value


def read_int(data, field, errors, required=False, minimum=None, maximum=None, default=None):
    value = data.get(field, default)
    if value is None or value == "":
        if required:
            errors[field] = "This field is required."
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        errors[field] = "Must be a whole number."
        return default
    if minimum is not None and number < minimum:
        errors[field] = f"Must be at least {minimum}."
    if maximum is not None and number > maximum:
        errors[field] = f"Must be at most {maximum}."
    return number


def read_float(data, field, errors, required=False, minimum=None, maximum=None, default=None):
    value = data.get(field, default)
    if value is None or value == "":
        if required:
            errors[field] = "This field is required."
        return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors[field] = "Must be a number."
        return default
    if minimum is not None and number < minimum:
        errors[field] = f"Must be at least {minimum}."
    if maximum is not None and number > maximum:
        errors[field] = f"Must be at most {maximum}."
    return number


def read_bool(data, field, default=False):
    value = data.get(field, default)
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "on")
    return bool(value)


def read_datetime(data, field, errors, required=False):
    value = data.get(field)
    if value is None or value == "":
        if required:
            errors[field] = "This field is required."
        return None
    try:
        return parse_datetime(value)
    except (TypeError, ValueError):
        errors[field] = "Must be a valid date and time."
        return None


def read_time_of_day(data, field, errors, required=False, default=None):
    """Read a 'HH:MM' value such as '09:30'."""
    value = read_string(data, field, errors, required=required, max_length=5, default=default)
    if value and not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", value):
        errors[field] = "Use 24-hour HH:MM format, e.g. 09:30."
    return value


def read_list_as_csv(data, field, errors, allowed=None, max_items=20):
    """
    Accept either a list (["a", "b"]) or a comma-separated string ("a, b")
    and store it as a clean comma-separated string "a,b".
    """
    value = data.get(field)
    if value is None or value == "":
        return ""
    items = value if isinstance(value, list) else str(value).split(",")
    cleaned = []
    for item in items:
        text = str(item).strip()
        if text and text not in cleaned:
            cleaned.append(text)
    if len(cleaned) > max_items:
        errors[field] = f"At most {max_items} items allowed."
    if allowed:
        invalid = [item for item in cleaned if item not in allowed]
        if invalid:
            errors[field] = f"Invalid values: {', '.join(invalid)}."
    return ",".join(cleaned)


def validate_email(email, errors, field="email"):
    if email and not EMAIL_PATTERN.match(email):
        errors[field] = "Enter a valid email address."


def validate_password_strength(password, errors, field="password"):
    if not password:
        return
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        errors[field] = "Password must be at least 8 characters and contain letters and numbers."


def read_pagination():
    """Read ?page=&per_page= from the URL with safe defaults."""
    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        raise ApiError("page and per_page must be numbers.", 400, "VALIDATION_ERROR")
    return page, per_page
