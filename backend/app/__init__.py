"""
app/__init__.py - The "application factory".

create_app() builds the Flask app step by step:
  1. load settings from config.py
  2. connect the database (SQLAlchemy) and JWT login system
  3. allow the React frontend to call the API (CORS)
  4. register the route modules ("blueprints")
  5. register error handlers so every error is returned as JSON
  6. create the database tables if they do not exist yet
"""
import os

from flask import Flask
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import BASE_DIR, Config

from .extensions import db, jwt
from .utils.responses import ApiError, error_response


def create_app(config_class=Config):
    app = Flask(__name__, instance_path=os.path.join(BASE_DIR, "instance"))
    app.config.from_object(config_class)

    if not app.config.get("JWT_SECRET_KEY") or not app.config.get("SECRET_KEY"):
        raise RuntimeError(
            "SECRET_KEY / JWT_SECRET_KEY are missing. Copy backend/.env.example to backend/.env first."
        )

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    register_blueprints(app)
    register_error_handlers(app)
    register_jwt_handlers()

    with app.app_context():
        from . import models  # noqa: F401  (makes sure every model is known before create_all)

        db.create_all()

    return app


def register_blueprints(app):
    from .routes.admin_routes import admin_bp
    from .routes.analytics_routes import analytics_bp
    from .routes.auth_routes import auth_bp
    from .routes.donation_routes import donation_bp
    from .routes.notification_routes import notification_bp
    from .routes.profile_routes import profile_bp
    from .routes.request_routes import request_bp

    for blueprint in (auth_bp, profile_bp, donation_bp, request_bp, notification_bp, admin_bp, analytics_bp):
        app.register_blueprint(blueprint)


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return error_response(error.message, error.status_code, error.code, error.details)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        # e.g. 404 for an unknown URL, 405 for a wrong HTTP method
        return error_response(error.description, error.code, error.name.upper().replace(" ", "_"))

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        # Log the full error for developers, but never show internal details to users.
        app.logger.exception("Unexpected server error")
        db.session.rollback()
        return error_response("Something went wrong on the server. Please try again.", 500, "SERVER_ERROR")


def register_jwt_handlers():
    """Return JWT problems (missing/expired/invalid token) in our standard JSON format."""
    from .models import TokenBlocklist

    @jwt.token_in_blocklist_loader
    def is_token_revoked(jwt_header, jwt_payload):
        return TokenBlocklist.query.filter_by(jti=jwt_payload["jti"]).first() is not None

    @jwt.unauthorized_loader
    def missing_token(reason):
        return error_response("Please log in to continue.", 401, "UNAUTHORIZED")

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return error_response("Your login token is invalid. Please log in again.", 401, "INVALID_TOKEN")

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return error_response("Your session has expired. Please log in again.", 401, "TOKEN_EXPIRED")

    @jwt.revoked_token_loader
    def revoked_token(jwt_header, jwt_payload):
        return error_response("You have logged out. Please log in again.", 401, "TOKEN_REVOKED")
