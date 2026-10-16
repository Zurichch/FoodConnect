"""
run.py - Starts the Flask development server.

Usage (from the backend folder, with the virtual environment active):
    python run.py
The API will then be available at http://127.0.0.1:5000/api
"""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
