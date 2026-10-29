# FoodConnect – Database Explanation

Database: **SQLite**, one file at `backend/instance/foodconnect.db`.
Library: **SQLAlchemy** (through Flask-SQLAlchemy). Each table is a Python class in `backend/app/models/`.

---

## 1. Key ideas in plain words

| Term | Meaning | Example |
|---|---|---|
| **Table** | A spreadsheet with fixed columns | `donations` |
| **Row** | One record | "Veg biryani, 40 servings" |
| **Primary key** | Unique id of a row | `donations.id = 18` |
| **Foreign key** | A column pointing to another table's id | `donations.donor_id → users.id` |
| **Relationship** | SQLAlchemy shortcut that follows a foreign key for you | `donation.donor.name` |
| **Index** | A sorted lookup list that makes searching faster | index on `donations.status` |
| **Constraint** | A rule the database itself enforces | `CHECK servings > 0`, `UNIQUE email` |
| **Transaction** | A group of changes saved together or not at all | `db.session.commit()` |
| **ORM** | Writing Python instead of SQL | `Donation.query.filter_by(status="AVAILABLE")` |

## 2. The tables

### `users` – `User` (`models/user.py`)
Everyone who can log in.
`id, name, email (unique, indexed), password_hash, role (donor|ngo|admin, CHECK), phone, address, area, postal_code, donor_type, is_suspended, suspension_reason, created_at, updated_at`
- `password_hash`: we never store the real password.
- `to_dict()` deliberately leaves out `password_hash`.

### `ngo_profiles` – `NGOProfile` (`models/ngo_profile.py`)
Extra organisation details for NGO users.
`id, user_id (FK → users, UNIQUE), organization_name, registration_number, description, address, service_areas, postal_codes, contact_phone, contact_email, opening_time, closing_time, max_capacity_servings (CHECK ≥ 0), pickup_lead_time_minutes, preferred_categories, dietary_preference, can_store_refrigerated, can_store_frozen, accepts_unpackaged, verification_status (pending|verified|rejected, indexed), verification_note, verified_at`
- Lists such as service areas are stored as comma-separated text (`"Adyar,Besant Nagar"`). Helper methods (`service_area_list()`) turn them into Python lists. This is simpler than extra tables; a bigger system would use a separate `service_areas` table.

### `donations` – `Donation` (`models/donation.py`)
One surplus-food listing.
`id, donor_id (FK → users), food_name, category, description, quantity, quantity_unit, servings, dietary_type, is_packaged, storage_type, allergens, prepared_at, expires_at, pickup_deadline, pickup_address, pickup_area, pickup_postal_code, pickup_latitude, pickup_longitude, notes, status, assigned_ngo_id (FK → ngo_profiles), safety_warnings (JSON text), safety_declaration, cancel_reason, scheduled_pickup_at, accepted_at, collected_at, delivered_at, servings_distributed, created_at, updated_at`
- **Quantity vs servings:** "12 kg" (how much) and "40 servings" (how many people) mean different things, so both are stored.
- Constraints: `CHECK servings > 0`, `CHECK quantity > 0`. Indexes: `donor_id`, `status`, `category`, `assigned_ngo_id`, `created_at`, and a combined `(status, pickup_deadline)` index used by the expiry check and the NGO list.

- `pickup_latitude` / `pickup_longitude`: optional exact map pin chosen by the donor (both empty if no pin). They were added after the first version, so `app/utils/db_upgrade.py` adds them to older database files automatically at start-up (`ALTER TABLE donations ADD COLUMN ...`). `db.create_all()` alone never changes an existing table.

### `collection_requests` – `CollectionRequest`
Connects one donation to one NGO.
`id, donation_id (FK), ngo_id (FK), initiated_by (ngo|donor, CHECK), status (pending|accepted|rejected|withdrawn), message, response_note, match_score, created_at, responded_at`
- `UNIQUE(donation_id, ngo_id)`: the same NGO cannot request the same donation twice — enforced by the database even if the code had a bug.

### `donation_status_history` – `DonationStatusHistory`
Every status change, never edited.
`id, donation_id (FK), old_status, new_status, changed_by_id (FK → users, empty = system), note, created_at`

### `notifications` – `Notification`
`id, user_id (FK), title, message, notification_type, donation_id (FK, optional), is_read, created_at`

### `audit_logs` – `AuditLog`
`id, actor_id (FK → users), action (e.g. NGO_VERIFIED), target_type, target_id, details, created_at`

### `donation_reports`, `contact_messages`, `token_blocklist` (`models/misc.py`)
Reports from users, public contact messages, and logged-out token ids.

## 3. Relationships in simple terms

```python
# models/user.py
ngo_profile = db.relationship("NGOProfile", back_populates="user", uselist=False)
donations   = db.relationship("Donation",   back_populates="donor")
```
- **One-to-one** (`User` ↔ `NGOProfile`): `uselist=False` means "give me one object, not a list". The `UNIQUE` on `ngo_profiles.user_id` makes it truly one-to-one.
- **One-to-many** (`User` → many `Donation`s): `user.donations` is a list; `donation.donor` is one user. `back_populates` keeps both sides in sync.
- **Donation → requests / history:** `cascade="all, delete-orphan"` means if a donation row were deleted, its requests and history would be deleted too (so nothing points to a missing donation).

So instead of writing SQL like
```sql
SELECT users.name FROM donations JOIN users ON users.id = donations.donor_id WHERE donations.id = 18;
```
we write `donation.donor.name`.

## 4. How data is saved and read

```python
# Create
donation = Donation(donor_id=donor.id, food_name="Idli", ...)
db.session.add(donation)          # put it in the "waiting to be saved" area
db.session.commit()               # write to the file (transaction)

# Read
Donation.query.filter_by(status="AVAILABLE").order_by(Donation.pickup_deadline).all()
db.session.get(Donation, 18)      # by primary key

# Update
donation.status = "COLLECTED"
db.session.commit()
```
If anything raises an error before `commit()`, nothing is saved, and our global error handler calls `db.session.rollback()`.

## 5. Preventing two NGOs from claiming one donation

`services/collection_service.py → accept_collection_request()` runs one SQL statement:

```sql
UPDATE donations
SET status = 'ACCEPTED', assigned_ngo_id = :ngo
WHERE id = :donation AND status = 'REQUESTED' AND assigned_ngo_id IS NULL;
```
The database executes this as one atomic step. The first accept changes **1 row**. A second accept (even a split second later) finds the status is no longer `REQUESTED`, changes **0 rows**, and the code returns `409 ALREADY_CLAIMED`. Reading the row first and then updating it in Python would have a gap where both requests could see `REQUESTED`; the conditional UPDATE closes that gap.

## 6. Moving to PostgreSQL later

Set `DATABASE_URL=postgresql://user:password@localhost:5432/foodconnect` in `backend/.env` and `pip install psycopg2-binary`. No model code changes. For schema changes over time, add **Flask-Migrate** (Alembic) instead of `db.create_all()`.
