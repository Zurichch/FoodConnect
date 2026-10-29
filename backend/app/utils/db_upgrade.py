"""
db_upgrade.py - Adds new columns to an EXISTING database file.

db.create_all() only creates missing TABLES; it never changes a table that
already exists. When we added the map feature, the donations table got two
new columns. Without this helper, an older foodconnect.db would crash with
"no such column: donations.pickup_latitude".

So at start-up we check each column below and add it if it is missing.
(A bigger project would use a migration tool such as Flask-Migrate instead.)
"""
from sqlalchemy import inspect, text

# (table, column, SQL type) - every column added after the first version of the schema
NEW_COLUMNS = [
    ("donations", "pickup_latitude", "FLOAT"),
    ("donations", "pickup_longitude", "FLOAT"),
]


def add_missing_columns(db):
    inspector = inspect(db.engine)
    existing_tables = inspector.get_table_names()
    added = []
    for table, column, sql_type in NEW_COLUMNS:
        if table not in existing_tables:
            continue  # create_all() will build the whole table, columns included
        current_columns = {c["name"] for c in inspector.get_columns(table)}
        if column not in current_columns:
            with db.engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
            added.append(f"{table}.{column}")
    return added
