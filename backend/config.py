"""
config.py - All backend settings live here.

Secrets (like the JWT signing key) are NEVER written in the code.
They are read from environment variables, which are loaded from the
`backend/.env` file by python-dotenv. Copy `.env.example` to `.env` to start.
"""
import os
from datetime import timedelta

from dotenv import load_dotenv

# Folder that contains this file (the "backend" folder).
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Load variables from backend/.env into os.environ (does nothing if the file is missing).
load_dotenv(os.path.join(BASE_DIR, ".env"))


def _default_sqlite_url():
    """SQLite database file stored in backend/instance/foodconnect.db."""
    db_path = os.path.join(BASE_DIR, "instance", "foodconnect.db")
    return "sqlite:///" + db_path.replace("\\", "/")


class Config:
    """Settings used when running the app normally (development / demo)."""

    APP_ENV = os.getenv("APP_ENV", "development")
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

    # Change DATABASE_URL to a PostgreSQL URL later without touching any model code.
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or _default_sqlite_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # A login token stays valid for this many hours, then the user must log in again.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_EXPIRES_HOURS", "8")))

    # Which frontend addresses may call the API from the browser (comma separated).
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

    TESTING = False


class TestConfig(Config):
    """Settings used by the automated tests: a throw-away in-memory database."""

    TESTING = True
    APP_ENV = "testing"
    SECRET_KEY = "test-only-secret-key"
    JWT_SECRET_KEY = "test-only-jwt-secret-key-that-is-long-enough"
    SQLALCHEMY_DATABASE_URI = "sqlite://"  # in-memory database
