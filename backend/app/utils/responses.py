"""
responses.py - One consistent JSON shape for every API response.

Success:  {"success": true,  "message": "...", "data": {...}}
Error:    {"success": false, "error": {"code": "...", "message": "...", "details": {...}}}

The React frontend relies on this shape, so every route uses these helpers.
"""
from flask import jsonify


class ApiError(Exception):
    """
    Raise this anywhere in a route or service to stop and return an error.

    Example:
        raise ApiError("Donation not found.", 404, "NOT_FOUND")
    The error handler registered in app/__init__.py turns it into JSON.
    """

    def __init__(self, message, status_code=400, code="BAD_REQUEST", details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}


def success_response(data=None, message="OK", status_code=200):
    body = {"success": True, "message": message, "data": data}
    return jsonify(body), status_code


def error_response(message, status_code=400, code="BAD_REQUEST", details=None):
    body = {
        "success": False,
        "error": {"code": code, "message": message, "details": details or {}},
    }
    return jsonify(body), status_code


def paginate_query(query, page, per_page, serializer):
    """
    Split a database query into pages.

    Returns a dict the frontend can use to show page numbers:
    {"items": [...], "page": 1, "per_page": 10, "total": 42, "pages": 5}
    """
    page = max(page, 1)
    per_page = min(max(per_page, 1), 50)
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [serializer(item) for item in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
    }
