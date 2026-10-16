"""
auth_helpers.py - The `auth_required` decorator used to protect routes.

How it works (step by step):
  1. The frontend sends   Authorization: Bearer <token>   with each request.
  2. verify_jwt_in_request() checks the token's signature and expiry.
  3. We read the user id stored inside the token and LOAD THE USER FROM THE DATABASE.
     We never trust a role or user id sent by the frontend in the request body.
  4. We block suspended accounts and users whose role is not allowed.
  5. The loaded user is stored in `g.current_user` for the route to use.
"""
from functools import wraps

from flask import g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..extensions import db
from ..models import User
from .responses import ApiError


def auth_required(*allowed_roles):
    """
    Protect a route. Usage:
        @auth_required()                 -> any logged-in user
        @auth_required("donor")          -> donors only
        @auth_required("ngo", "admin")   -> NGOs or admins
    """

    def decorator(route_function):
        @wraps(route_function)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = db.session.get(User, int(user_id)) if user_id else None
            if user is None:
                raise ApiError("Your account no longer exists. Please log in again.", 401, "UNAUTHORIZED")
            if user.is_suspended:
                raise ApiError("This account has been suspended. Contact support.", 403, "ACCOUNT_SUSPENDED")
            if allowed_roles and user.role not in allowed_roles:
                raise ApiError("You do not have permission to perform this action.", 403, "FORBIDDEN")
            g.current_user = user
            return route_function(*args, **kwargs)

        return wrapper

    return decorator


def current_user():
    """The logged-in user (only valid inside a route protected by auth_required)."""
    return g.current_user


def current_ngo_profile():
    """The NGO profile of the logged-in NGO user, or an error if it is missing."""
    user = g.current_user
    if user.ngo_profile is None:
        raise ApiError("NGO profile not found for this account.", 404, "NGO_PROFILE_MISSING")
    return user.ngo_profile
