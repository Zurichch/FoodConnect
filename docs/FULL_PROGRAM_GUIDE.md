# FoodConnect – Complete Program Guide (Context Handover)

This is the one document to read before explaining FoodConnect to anyone: examiners, teammates, or a new AI session. It covers **what the program does, how every part works, every file, every table, every API, every rule, how to run it, and how to present it.**

**Tagline:** "Turn surplus food into shared hope."
**Project type:** end-semester engineering project, team of 3.
**Stack:** React (Vite, Tailwind) + Flask (SQLAlchemy, JWT) + SQLite.

---

## PART A — THE BIG PICTURE

### A1. What problem does it solve?
Restaurants, hotels, college canteens, bakeries, supermarkets, caterers and households throw away edible surplus food every day, while shelters and community kitchens nearby lack food. Today the two sides are connected through phone calls and WhatsApp groups. That approach has several problems:
- it does not scale;
- nobody checks whether the receiving NGO can store the food or collect it in time;
- two NGOs can turn up for the same food;
- there is no record of what happened;
- donors never see their impact.

### A2. What does FoodConnect do?
1. **Donors** list surplus food with its details and times.
2. The **backend checks food-safety time rules**. Expired or impossible donations are blocked; risky ones get warnings.
3. An **explainable matching algorithm** scores every verified NGO out of 100 and explains why.
4. **NGOs** request the food, or the donor offers it to a chosen NGO. **Only one NGO can ever win a donation.**
5. The donation moves through a **validated lifecycle**: AVAILABLE → REQUESTED → ACCEPTED → PICKUP_SCHEDULED → COLLECTED → DELIVERED. Every step is recorded and triggers notifications.
6. **Dashboards** show statistics calculated from the database.
7. **Admins** verify NGOs, suspend bad accounts, remove unsafe donations, handle reports and read an audit log.

### A3. The three user roles

| Role | Examples | Main abilities |
|---|---|---|
| **Donor** | restaurant, hotel, canteen, bakery, supermarket, caterer, individual | create, edit, cancel and track donations; see NGO recommendations; offer food to an NGO; accept or reject NGO requests; view history, impact and notifications |
| **NGO** | food bank, shelter, community kitchen | maintain profile and capacity; see recommended donations; browse and filter available food; request donations; accept donor offers; update pickup → collected → delivered |
| **Admin** | platform operator | verify or reject NGOs; suspend or reactivate users; inspect all donations and requests; remove donations; resolve reports; read contact messages; view analytics and the audit log |

A new NGO starts as **pending** and must be verified by an admin before it can request food or appear in recommendations. **Nobody can register as admin**; the admin account is created only by the seed script.

### A4. Honest boundaries (say these confidently)
- Matching is **rule-based, explainable scoring**, not a trained ML model. It is built so a model can replace it later.
- Location is **area and postal-code based**, not GPS distance.
- Tracking is **status tracking refreshed every 15 seconds**, not live GPS.
- The app **cannot certify food is safe**. It checks the information entered, and the donor is responsible.
- The kg and CO₂ figures are **illustrative estimates**. All counts are real database values.

---

## PART B — HOW TO RUN IT

### B1. On this laptop (already installed)
**Terminal 1 (backend):**
```
cd "C:\Users\mailn\OneDrive\Documents\College_2\7th sem\food\backend"
venv\Scripts\activate
python seed.py          (resets demo data with fresh times; do this before every demo)
python run.py           (API at http://127.0.0.1:5000/api)
```
**Terminal 2 (frontend):**
```
cd "C:\Users\mailn\OneDrive\Documents\College_2\7th sem\food\frontend"
npm run dev             (open http://localhost:5173)
```
**Tests:** in `backend`, with the venv active, run `python -m pytest -q`. Expected result: **54 passed**.

### B2. On a new laptop (first time)
1. Install Python 3.11+ (tick "Add to PATH") and Node.js 18+.
2. Backend: run `python -m venv venv`, `venv\Scripts\activate`, `pip install -r requirements.txt` and `copy .env.example .env`.
3. Frontend: run `npm install`.
4. Then follow the steps in B1.

### B3. Demo logins (local only; passwords come from `backend/.env`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@foodconnect.demo | DemoAdmin@2026 |
| Donor | restaurant@foodconnect.demo (also hotel@, canteen@, bakery@, priya@) | DemoUser@2026 |
| NGO (verified) | helpinghands@foodconnect.demo (also annadhanam@, greenplate@, annanagar@) | DemoUser@2026 |
| NGO (pending) | littlelights@foodconnect.demo | DemoUser@2026 |

### B4. The database file
`backend\instance\foodconnect.db` is a single SQLite file. Open it with **DB Browser for SQLite**: Open Database Read Only → choose the file → Browse Data.

### B5. Gotchas
- **Re-run `python seed.py` before every demo.** The demo times are relative to "now", so open donations expire within hours. Seeding **wipes all data**.
- **One login per browser.** The token lives in localStorage, so tabs share it. Use different browsers or incognito windows for different roles.
- **"Cannot reach the FoodConnect server"** means the backend is not running.
- **"Port already in use"** means another copy is running; close it.
- **PowerShell blocks `activate`:** use cmd, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

---

## PART C — ARCHITECTURE

### C1. The three layers
```
┌──────────── BROWSER ─────────────┐        ┌───────────── FLASK SERVER (:5000) ─────────────┐
│ React pages (frontend/src/pages) │        │ routes/  → which URL, who may call it          │
│   ↓ call                         │  JSON  │ utils/auth_helpers → checks JWT + role         │
│ services/*.js (Axios + token)    │ ─────► │ utils/validators   → checks the input          │
│                                  │ ◄───── │ services/          → business rules            │
│ Vite dev server (:5173) proxies  │        │ models/ (SQLAlchemy) → reads/writes            │
│ /api → :5000                     │        └──────────────────────┬──────────────────────────┘
└──────────────────────────────────┘                               ▼
                                                     SQLite file: backend/instance/foodconnect.db
```

### C2. One request, end to end (memorise this)
1. The user clicks a button on a React page.
2. The page calls a function in `src/services/` (e.g. `createDonation(form)`).
3. Axios (`services/api.js`) sends JSON to `/api/...` and adds `Authorization: Bearer <JWT>`.
4. Vite forwards `/api` to Flask on port 5000.
5. Flask matches the URL to a route function in a **blueprint**.
6. `@auth_required(role)` verifies the token, **reloads the user from the DB**, and checks the role and suspension.
7. The route validates the input (`utils/validators.py`) and calls the business rules (`services/`).
8. SQLAlchemy reads/writes SQLite; `db.session.commit()` saves everything in one transaction.
9. Flask returns `{success, message, data}` or `{success:false, error:{code, message, details}}` with an HTTP status code.
10. React shows the data, or shows the error message under the right form field.

### C3. Why each technology
| Technology | Why it was chosen |
|---|---|
| React 18 + Vite | component-based UI; fast dev server with an API proxy |
| JavaScript (not TypeScript) | easier for beginners |
| Tailwind CSS 3 | consistent design with utility classes; shared recipes in `index.css` |
| React Router 6 | one URL per page; protected routes |
| Axios | interceptors add the token and handle expiry in one place |
| Recharts | simple charts for the dashboards |
| Lucide React | clean icons |
| Flask 3 + Blueprints | small, readable Python web framework; one file per feature |
| Flask-SQLAlchemy | Python classes instead of SQL; can switch to PostgreSQL via `DATABASE_URL` |
| Flask-JWT-Extended | standard token login |
| Werkzeug | password hashing |
| Flask-CORS | only the allowed frontend origins can call the API |
| SQLite | zero setup; one file |
| pytest | simple automated tests with an in-memory DB |
| Plain-Python scoring | deterministic, explainable, free, offline |

---

## PART D — EVERY FILE EXPLAINED

### D1. Backend (`backend/`)
| File | Purpose |
|---|---|
| `run.py` | Starts the Flask development server on 127.0.0.1:5000. |
| `config.py` | Loads `.env`. Defines `Config` (secrets, DB URL, token lifetime 8 h, CORS origins) and `TestConfig` (in-memory DB). |
| `.env.example` / `.env` | Secret keys and demo passwords. `.env` is never committed. |
| `requirements.txt` | Python packages: Flask, Flask-Cors, Flask-SQLAlchemy, SQLAlchemy, Flask-JWT-Extended, python-dotenv, pytest. |
| `seed.py` | Drops and recreates all tables, then inserts demo data. Refuses to run if `APP_ENV=production`. |
| `app/__init__.py` | `create_app()`: loads config, refuses to start without secrets, connects db/jwt/CORS, registers 7 blueprints, JSON error handlers, JWT error callbacks + token blocklist, `db.create_all()`. |
| `app/extensions.py` | Creates the shared `db` and `jwt` objects; switches on SQLite foreign keys. |
| **Models** (`app/models/`) | |
| `user.py` | `User`: accounts, password hashing (`set_password`/`check_password`), `to_dict()` without the hash. |
| `ngo_profile.py` | `NGOProfile`: organisation, service areas, capacity, preferences, storage abilities, verification. |
| `donation.py` | `Donation`: food details, times, location, status, assigned NGO, safety warnings; `to_dict(include_private)`. |
| `collection_request.py` | `CollectionRequest`: a donation ↔ NGO link (`initiated_by` ngo/donor, status). |
| `status_history.py` | `DonationStatusHistory`: one row per status change. |
| `notification.py` | `Notification`: in-app messages. |
| `audit_log.py` | `AuditLog`: admin actions. |
| `misc.py` | `DonationReport`, `ContactMessage`, `TokenBlocklist`. |
| `__init__.py` | Imports every model so they can be imported from one place. |
| **Routes** (`app/routes/`) | |
| `auth_routes.py` | register, login, logout, me |
| `profile_routes.py` | own profile, password, NGO profile, NGO dashboard |
| `donation_routes.py` | safety preview, create, list, edit, cancel, matches, NGO lists, status updates, details, report |
| `request_routes.py` | NGO request, donor offer, incoming/sent lists, accept, reject, withdraw |
| `notification_routes.py` | list, unread count, mark read |
| `admin_routes.py` | users, NGO verification, donations, moderation, reports, contact messages, audit log |
| `analytics_routes.py` | donor/NGO/admin analytics, public stats, contact form, health |
| **Services** (`app/services/`: the business rules) | |
| `matching.py` | ★ the explainable matching algorithm |
| `food_safety.py` | ★ safety errors, warnings, checklist, disclaimer |
| `lifecycle.py` | ★ allowed status transitions, `change_status`, automatic expiry |
| `collection_service.py` | ★ requests/offers and the **atomic accept** |
| `analytics.py` | dashboard formulas |
| `notification_service.py` | `notify_user`, `notify_admins`, `record_audit` |
| **Utils** (`app/utils/`) | |
| `auth_helpers.py` | the `auth_required(*roles)` decorator; `current_user()`; `current_ngo_profile()` |
| `validators.py` | `read_string`, `read_int`, `read_choice`, `read_datetime`, `read_list_as_csv`, email/password checks, `raise_if_errors`, pagination parameters |
| `responses.py` | `ApiError`, `success_response`, `error_response`, `paginate_query` |
| `constants.py` | every allowed value: roles, categories, diets, storage types, units, statuses |
| `time_utils.py` | `utc_now`, `parse_datetime`, `to_iso`, `hours_between` |
| **Tests** (`tests/`) | |
| `conftest.py` | fresh in-memory app per test, plus helper functions |
| `test_matching.py` | 13 tests |
| `test_food_safety.py` | 9 tests |
| `test_auth.py` | 13 tests |
| `test_donations.py` | 19 tests |

### D2. Frontend (`frontend/`)
| File | Purpose |
|---|---|
| `package.json` | dependencies and scripts (`npm run dev`, `npm run build`) |
| `vite.config.js` | dev server on 5173; **proxy `/api` → 127.0.0.1:5000** |
| `tailwind.config.js` | brand green palette (`brand-50` … `brand-900`), Inter font |
| `index.html` | page shell, title, favicon |
| `src/main.jsx` | starts React; wraps the app in `BrowserRouter` + `AuthProvider` |
| `src/App.jsx` | every URL → page, with role protection |
| `src/index.css` | Tailwind plus reusable classes: `btn-primary`, `card`, `input`, `label` ... |
| **context/** `AuthContext.jsx` | current user; `login`, `register`, `logout`, `refreshUser`; `dashboardPathFor(role)` |
| **services/** `api.js` | Axios instance, token interceptor, auto-logout on 401, `unwrap`, `getErrorMessage`, `getFieldErrors` |
| `authService.js`, `donationService.js`, `requestService.js`, `ngoService.js`, `notificationService.js`, `adminService.js`, `publicService.js` | one small function per API endpoint |
| **hooks/** `useAuth.js` | read the logged-in user |
| `useApi.js` | load data with `isLoading`/`error`, `reload()`, and optional polling (`pollMs`) |
| `useToast.js` | temporary success/error messages |
| **layouts/** `PublicLayout.jsx` | top navbar + footer for public pages |
| `DashboardLayout.jsx` | role-specific sidebar, top bar, notification bell (polls every 20 s), mobile drawer |
| **components/** `ui.jsx` | Spinner, PageLoader, EmptyState, Alert, Toast, PageHeader, StatCard, Pagination, FormField, Tabs |
| `StatusBadge.jsx` | coloured status pill |
| `DonationCard.jsx` | donation summary card |
| `MatchCard.jsx` | score circle + explanation + score breakdown bars |
| `DonationTimeline.jsx` | 6-step progress bar + history list |
| `SafetyChecklist.jsx` | checklist + warnings + disclaimer |
| `ConfirmDialog.jsx` | "are you sure?" pop-up with optional text, date and number inputs |
| `ProtectedRoute.jsx` | redirects users who are not logged in or have the wrong role |
| `Charts.jsx` | monthly trend chart and category chart |
| `Logo.jsx` | brand mark |
| **utils/** `constants.js` | labels and colours for statuses, categories etc. (must match the backend) |
| `format.js` | date formatting, relative time, local ↔ UTC conversion |
| `validation.js` | quick browser-side form checks |

### D3. Pages (30 page files)
| Area | Page file | URL | What it shows / does |
|---|---|---|---|
| Public | LandingPage | `/` | hero, **live DB statistics**, 3 steps, benefits, matching weights, lifecycle |
| | AboutPage | `/about` | problem, solution, objectives, limitations |
| | HowItWorksPage | `/how-it-works` | steps per role, score table, status meanings |
| | ContactPage | `/contact` | message saved to the DB (admins read it) |
| | LoginPage / RegisterPage | `/login`, `/register` | login; donor or NGO sign-up |
| | NotFoundPage | `*` | 404 page |
| Donor | DonorDashboard | `/donor` | stats, charts, active donations |
| | CreateDonationPage | `/donor/donations/new`, `/…/:id/edit` | donation form + live safety panel |
| | MyDonationsPage | `/donor/donations` | all donations with filter, search and pages |
| | MatchRecommendationsPage | `/donor/donations/:id/matches` | ranked NGOs; offer to an NGO |
| | DonorRequestsPage | `/donor/requests` | accept/reject NGO requests; see sent offers |
| | DonationHistoryPage | `/donor/history` | finished donations table |
| NGO | NgoDashboard | `/ngo` | verification status, capacity, servings, top matches, charts |
| | RecommendedDonationsPage | `/ngo/recommended` | donations ranked for this NGO |
| | AvailableDonationsPage | `/ngo/available` | all open donations with filters |
| | NgoRequestsPage | `/ngo/requests` | donor offers; requests sent |
| | CollectionsPage | `/ngo/active`, `/ngo/completed` | assigned donations |
| | NgoProfilePage | `/ngo/profile` | areas, capacity, preferences, storage |
| Admin | AdminDashboard | `/admin` | overview, alerts, recent activity |
| | UserManagementPage | `/admin/users` | search, suspend, reactivate |
| | NgoVerificationPage | `/admin/ngos` | verify or reject NGOs |
| | DonationManagementPage | `/admin/donations` | all donations |
| | ReportsPage | `/admin/reports` | reports + contact messages |
| | PlatformAnalyticsPage | `/admin/analytics` | full analytics |
| | AuditLogPage | `/admin/audit-log` | admin action log |
| Shared | DonationDetailsPage | `/donations/:id` | details, **timeline (polls every 15 s)**, checklist, requests, action buttons |
| | NotificationsPage | `/notifications` | notifications |
| | ProfilePage | `/profile` | account + password |
| | RequestsPage | (used by both requests pages) | shared request list logic |

---

## PART E — DATABASE

### E1. Tables (10)
| Table (model) | Purpose | Key columns |
|---|---|---|
| `users` (User) | every account | id, name, **email UNIQUE**, **password_hash**, role (CHECK donor/ngo/admin), phone, area, postal_code, donor_type, is_suspended |
| `ngo_profiles` (NGOProfile) | organisation details | **user_id UNIQUE FK**, organization_name, service_areas, postal_codes, max_capacity_servings, pickup_lead_time_minutes, preferred_categories, dietary_preference, can_store_refrigerated/frozen, accepts_unpackaged, verification_status |
| `donations` (Donation) | food listings | donor_id FK, food_name, category, quantity + unit, **servings (CHECK > 0)**, dietary_type, is_packaged, storage_type, allergens, prepared_at, expires_at, pickup_deadline, pickup_address/area/postal_code, **status**, assigned_ngo_id FK, safety_warnings, timestamps |
| `collection_requests` (CollectionRequest) | donation ↔ NGO | donation_id FK, ngo_id FK, **initiated_by**, status, message, match_score; **UNIQUE(donation_id, ngo_id)** |
| `donation_status_history` | every status change | donation_id, old_status, new_status, changed_by_id, note, created_at |
| `notifications` | in-app messages | user_id, title, message, type, donation_id, is_read |
| `audit_logs` | admin actions | actor_id, action, target_type, target_id, details |
| `donation_reports` | flagged donations | donation_id, reporter_id, reason, status, resolution_note |
| `contact_messages` | contact form | name, email, subject, message |
| `token_blocklist` | logged-out tokens | jti (unique) |

### E2. Relationships
- **User 1–1 NGOProfile:** `uselist=False`, plus UNIQUE on `user_id`.
- **User 1–N Donation:** `user.donations` and `donation.donor`.
- **NGOProfile 1–N Donation:** through `assigned_ngo_id`.
- **Donation 1–N CollectionRequest** and **Donation 1–N DonationStatusHistory:** `cascade="all, delete-orphan"`.
- **User 1–N Notification**; **User 1–N AuditLog**.

```
users ─┬─1:1─ ngo_profiles ─1:N─┐
       ├─1:N─ donations ─┬──────┴─ (assigned_ngo_id)
       │                 ├─1:N─ collection_requests ─N:1─ ngo_profiles
       │                 ├─1:N─ donation_status_history
       │                 └─1:N─ donation_reports
       ├─1:N─ notifications
       └─1:N─ audit_logs
```

### E3. Important database ideas
- **Quantity vs servings** are stored separately: "12 kg" is how much food; "40 servings" is how many people it feeds.
- **Times** are stored in UTC. The API sends `…Z` strings, and the browser shows local time.
- **Lists as CSV text:** service areas, PINs and categories are stored as comma-separated text. This is a beginner-friendly simplification.
- **Transactions:** related changes are committed together with `db.session.commit()`; errors trigger a rollback.
- **Indexes** on status, deadline, foreign keys and dates make lookups fast.
- **Foreign keys** are enforced (`PRAGMA foreign_keys=ON`).
- **To use PostgreSQL:** set `DATABASE_URL` in `.env`. No model code changes are needed.

### E4. Demo data (from `seed.py`)
- **11 users:** 1 admin, 5 donors, 5 NGOs.
- **5 NGOs:**
  - Helping Hands Food Bank (Adyar; any diet; 300 capacity; fridge)
  - Annadhanam Trust (T. Nagar; vegetarian only; 150)
  - Green Plate Shelter (Velachery; packaged only; fridge + freezer; 120)
  - Anna Nagar Community Kitchen (prefers vegetarian; accepts all categories; 200)
  - Little Lights Children's Home (**pending verification**)
- **17 donations** covering every status: 6 delivered across past months (for the charts), plus cancelled, expired, rejected, collected, pickup-scheduled, accepted, 2 requested (one NGO request, one donor offer) and 3 available ones ready for live matching.
- Also: 12 requests, history rows, 44 notifications, 2 reports (one open), 1 contact message and audit entries.

---

## PART F — AUTHENTICATION & SECURITY

1. **Registration:** the password must be 8+ characters with letters and numbers. It is stored as a **Werkzeug hash**, never as plain text. Duplicate emails are rejected. The role must be donor or NGO.
2. **Login:** the typed password is hashed and compared with the stored hash. If they match, the server creates a **JWT** with `identity = user id`, signed with `JWT_SECRET_KEY` and valid for 8 hours. Wrong details give 401; a suspended user gets 403.
3. **Using the token:** React stores it in localStorage, and Axios sends it as `Authorization: Bearer …` with every request.
4. **`auth_required(*roles)`** runs on every protected route:
   1. checks the token's signature and expiry;
   2. **loads the user from the database**;
   3. blocks suspended users (403);
   4. checks the role (403).
   Because the role and suspension come from the DB, editing the token or using an old one cannot grant extra access.
5. **Ownership checks:** a donor can only touch their own donations; only the assigned NGO can update collection status; only the receiving party can accept a request; only the creator can withdraw it.
6. **Logout:** the token's `jti` goes into `token_blocklist`, so it can never be used again (401 TOKEN_REVOKED).
7. **Frontend protection** (`ProtectedRoute`) is for convenience only. **The backend is the real security.**
8. **Privacy:** NGOs see only the area and PIN until the donor accepts them. The exact address and phone are visible only to the owner, the assigned NGO and admins.
9. **Secrets:** kept in `.env`, never in code. The app refuses to start without them.
10. **CORS:** only `localhost:5173` / `127.0.0.1:5173` may call the API from a browser.

---

## PART G — THE MATCHING ALGORITHM (`services/matching.py`)

### G1. Stage 1: hard filters (an NGO is excluded if any rule fails)
| Code | Rule |
|---|---|
| NOT_VERIFIED | NGO not verified by an admin |
| SUSPENDED | NGO account suspended |
| DIETARY | vegetarian-only NGO + non-veg food; vegan-only NGO + non-vegan food |
| STORAGE | refrigerated food, but the NGO can't refrigerate; frozen food, but it can't freeze |
| PACKAGING | unpackaged food, but the NGO accepts only packaged |
| CAPACITY | remaining capacity < servings |
| DEADLINE | now + travel minutes > pickup deadline |
| LOCATION | not the same area/PIN and not even the same postal district |

**Remaining capacity** = max capacity − servings of the NGO's donations that are ACCEPTED, PICKUP_SCHEDULED or COLLECTED.

### G2. Stage 2: the score (out of 100)
| Component | Max | Points |
|---|---|---|
| Location | 30 | 30: area or PIN in the NGO's list · 15: same first 3 PIN digits (same district, e.g. all Chennai = 600) |
| Capacity | 20 | 20: free ≥ 2× servings · 15: ≥ 1.25× · 10: ≥ 1× |
| Category | 15 | 15: preferred, or the NGO accepts all · 6: accepted but not preferred |
| Dietary | 15 | 15: compatible · 7: "prefers vegetarian" NGO + non-veg food |
| Deadline | 20 | spare time after travel: 20 if ≥ 3 h · 14 if ≥ 1 h · 8 if ≥ 0 |

- **score = location + capacity + category + dietary + deadline**
- **Ranking:** highest score first; ties go to more spare capacity, then alphabetical name. The result is fully deterministic.
- **Explanation:** the five reasons are joined into one sentence: "Recommended because the NGO serves the pickup area (Adyar), has plenty of spare capacity (…), prefers cooked meals, accepts vegetarian food, and can collect comfortably before the deadline (… h to spare)." The sentence comes from the same values that produced the points, so it always matches the score.

### G3. Worked example (proven by a unit test)
**Donation:** non-veg cooked meal, 40 servings, unpackaged, Adyar 600020, deadline in 5 h.
**NGO:** serves Guindy 600032, 60 servings free, prefers bakery, prefers vegetarian, 30 min travel.

| Component | Working | Points |
|---|---|---|
| Location | not the same area/PIN, but 600 = 600 | 15 |
| Capacity | 60/40 = 1.5 | 15 |
| Category | not preferred | 6 |
| Dietary | prefers veg, food is non-veg | 7 |
| Deadline | 5 − 0.5 = 4.5 h spare | 20 |
| **Total** | | **63 / 100** |

### G4. Why this design
- Explainable and checkable by hand.
- Deterministic.
- No training data needed.
- Free and offline.
- Safety filters come before scoring, so **a score can never override safety**.
- Upgrade path: replace `calculate_match_score()` with an ML model that returns the same shape.

### G5. Used in two directions
- `rank_ngos_for_donation()`: the donor's recommendation page.
- `rank_donations_for_ngo()`: the NGO's "Recommended for you" page.

---

## PART H — FOOD SAFETY (`services/food_safety.py`)

### H1. Blocking errors (the donation is not saved; HTTP 422)
- Any of the three times is missing.
- Preparation time is in the future (10-minute tolerance).
- **Use-by time already passed (expired).**
- Use-by is not after the preparation time.
- Pickup deadline already passed, or less than **30 minutes** away.
- **Pickup deadline is after the use-by time.**
- Perishable food (cooked meals, dairy, bakery; not frozen) was prepared more than **72 hours** ago.
- The safety declaration is not ticked.

### H2. Warnings (saved and shown to NGOs)
- Use-by within 2 hours (urgent).
- Holding time longer than the guideline: room temperature 6 h, refrigerated 48 h, frozen 30 days (perishable categories only).
- Unpackaged cooked food: keep it covered.
- Refrigerated or frozen food needs the cold chain kept.
- No allergen information.

### H3. Other safety features
- The details page shows a **checklist** of preparation time, use-by, storage, packaging, pickup deadline and diet/allergens.
- **Disclaimer:** "FoodConnect does not certify food safety. The donor is responsible for accurate information and for complying with applicable local food-safety regulations."
- **Live preview:** the form calls `POST /api/donations/safety-check` while the donor types; nothing is saved.
- Matching only ever sees donations that passed these checks.
- An NGO cannot schedule or collect food that is past its use-by time.

---

## PART I — DONATION LIFECYCLE (`services/lifecycle.py`)

### I1. Statuses
| Status | Meaning | Set by |
|---|---|---|
| AVAILABLE | published, waiting for an NGO | system (on create, or when all requests close) |
| REQUESTED | at least one pending request or offer | system |
| ACCEPTED | one NGO confirmed (atomic claim) | system, on accept |
| PICKUP_SCHEDULED | NGO planned a pickup time | assigned NGO |
| COLLECTED | NGO picked up the food | assigned NGO |
| DELIVERED | distributed (records servings distributed) | assigned NGO |
| CANCELLED | donor cancelled | owner donor |
| EXPIRED | time ran out | system |
| REJECTED | removed by moderation | admin |

### I2. Allowed transitions (`ALLOWED_TRANSITIONS`)
```
AVAILABLE        → REQUESTED, CANCELLED, EXPIRED, REJECTED
REQUESTED        → AVAILABLE, ACCEPTED, CANCELLED, EXPIRED, REJECTED
ACCEPTED         → PICKUP_SCHEDULED, CANCELLED, EXPIRED
PICKUP_SCHEDULED → COLLECTED, CANCELLED, EXPIRED
COLLECTED        → DELIVERED
DELIVERED / CANCELLED / EXPIRED / REJECTED → (final; nothing after)
```
Anything else returns **409 INVALID_STATUS_TRANSITION**, along with the list of allowed next statuses.

### I3. What every status change does
`change_status()`:
1. checks the transition;
2. updates the status and its timestamp (`accepted_at`, `collected_at`, `delivered_at`);
3. adds a **DonationStatusHistory** row (old, new, who, when, note).

The caller then adds **notifications** and commits.

### I4. Automatic expiry (no scheduler needed)
`expire_overdue_donations()` runs at the start of list and detail APIs:
- AVAILABLE/REQUESTED donations past the **pickup deadline** become EXPIRED.
- ACCEPTED/PICKUP_SCHEDULED donations past the **use-by time** become EXPIRED.

Pending requests are closed and the donor (and assigned NGO) are notified.

### I5. Tracking
- The details page re-fetches every **15 seconds**; lists every 20–30 s; the bell every 20 s.
- It is **status tracking via polling**, not GPS.

---

## PART J — COLLECTION REQUESTS & THE ATOMIC CLAIM (`services/collection_service.py`)

**Two directions:**
- **NGO request** (`initiated_by='ngo'`): the NGO asks; the **donor** accepts or rejects.
- **Donor offer** (`initiated_by='donor'`): the donor picks a recommended NGO; the **NGO** accepts or rejects.
- Rule: whoever did *not* create the request decides. The creator can withdraw it while it is pending.

**Rules when creating a request:**
- the donation must be open and not expired;
- one request per NGO per donation (DB UNIQUE, plus 409 DUPLICATE_REQUEST);
- the NGO must be verified;
- for an NGO request, every hard filter except location must pass (an NGO may choose to travel further);
- for a donor offer, every hard filter must pass (422 NOT_ELIGIBLE).

The first request moves the donation AVAILABLE → REQUESTED.

**Accept (`accept_collection_request`):**
1. Check the caller is the responder, the request is pending, the donation hasn't expired and the NGO has capacity.
2. **Atomic claim:**
   ```sql
   UPDATE donations SET status='ACCEPTED', assigned_ngo_id=:ngo
   WHERE id=:id AND status='REQUESTED' AND assigned_ngo_id IS NULL
   ```
   - 1 row changed → success.
   - 0 rows changed → another NGO already won → **409 ALREADY_CLAIMED**.
   - The database runs this as one indivisible step, so two simultaneous accepts cannot both succeed.
3. Write a history row; mark this request accepted; **automatically reject every other pending request** and notify those NGOs; notify the winner and the donor; commit.

**Reject or withdraw:** the request closes. If no pending requests remain, the donation goes back to AVAILABLE.

---

## PART K — NOTIFICATIONS & AUDIT

**Notifications** are created only by backend events (`notify_user`), in the same transaction as the change:
- new NGO request → donor
- donor offer → NGO
- request accepted → NGO + donor
- request rejected or closed → the other party
- pickup scheduled ("keep it ready for collection") → donor
- collected → donor
- delivered → donor
- cancelled → assigned NGO
- expired → donor (+ NGO)
- NGO verified or rejected → NGO
- new NGO registration or report → admins
- account reactivated → user

**Audit log** (`record_audit`): NGO_VERIFIED, NGO_REJECTED, USER_SUSPENDED, USER_REACTIVATED, DONATION_REJECTED, REPORT_RESOLVED, REPORT_DISMISSED. There is no API to edit or delete audit entries.

---

## PART L — ANALYTICS (`services/analytics.py`)

| Metric | Formula |
|---|---|
| Total donations | count of all donation rows |
| Available | AVAILABLE + REQUESTED |
| Awaiting collection | ACCEPTED + PICKUP_SCHEDULED |
| Completed | DELIVERED |
| Servings recovered | sum of servings of COLLECTED + DELIVERED donations |
| Completion rate | DELIVERED ÷ (DELIVERED + CANCELLED + EXPIRED + REJECTED) × 100 (in-progress donations excluded) |
| Monthly trends | donations created and delivered per month, last 6 months |
| Categories | donations per food category |
| NGO activity | per NGO: requests made, collections, servings collected |
| NGO servings received / distributed | collected + delivered servings / sum of `servings_distributed` |
| **Estimate (illustrative)** | food kg = servings × 0.4; CO₂e kg = food kg × 2.5. Labelled "not measured". |

The same functions serve the donor dashboard (filtered by donor), the NGO dashboard (filtered by NGO), the admin dashboard and the landing page.

---

## PART M — ALL 53 API ENDPOINTS

**Response format:**
- Success: `{"success": true, "message": "...", "data": {...}}`
- Error: `{"success": false, "error": {"code", "message", "details"}}`

**Status codes:** 200 OK · 201 created · 400 validation · 401 not logged in / bad token · 403 forbidden / suspended · 404 not found · 409 conflict (transition, claimed, duplicate) · 422 rule failed (safety, eligibility) · 500 server error.

| # | Method | URL | Who | Purpose |
|---|---|---|---|---|
| 1 | GET | /api/health | Public | server check |
| 2 | GET | /api/public/stats | Public | landing page statistics |
| 3 | POST | /api/public/contact | Public | contact message |
| 4 | POST | /api/auth/register | Public | register donor or NGO |
| 5 | POST | /api/auth/login | Public | log in → token |
| 6 | POST | /api/auth/logout | Any | revoke token |
| 7 | GET | /api/auth/me | Any | current user |
| 8 | GET | /api/profile | Any | own profile |
| 9 | PUT | /api/profile | Any | update profile |
| 10 | PUT | /api/profile/password | Any | change password |
| 11 | GET | /api/ngo/profile | NGO | NGO profile |
| 12 | PUT | /api/ngo/profile | NGO | update capacity/preferences |
| 13 | GET | /api/ngo/dashboard | NGO | NGO statistics |
| 14 | POST | /api/donations/safety-check | Donor | preview safety rules |
| 15 | POST | /api/donations | Donor | create donation |
| 16 | GET | /api/donations/mine | Donor | own donations (scope/status/search/page) |
| 17 | PUT | /api/donations/<id> | Donor (owner) | edit (AVAILABLE, no requests) |
| 18 | POST | /api/donations/<id>/cancel | Donor (owner) | cancel |
| 19 | GET | /api/donations/<id>/matches | Donor (owner), Admin | ranked NGOs |
| 20 | POST | /api/donations/<id>/offer | Donor (owner) | offer to an NGO |
| 21 | GET | /api/donations/available | NGO | open donations + filters |
| 22 | GET | /api/donations/recommended | NGO | donations ranked for this NGO |
| 23 | GET | /api/donations/collections | NGO | assigned (active/completed) |
| 24 | POST | /api/donations/<id>/requests | NGO (verified) | request a donation |
| 25 | POST | /api/donations/<id>/status | NGO (assigned) | schedule / collected / delivered |
| 26 | GET | /api/donations/<id> | Any with access | details, history, checklist, actions |
| 27 | POST | /api/donations/<id>/report | Donor/NGO | report a donation |
| 28 | GET | /api/requests/incoming | Donor/NGO | waiting for my decision |
| 29 | GET | /api/requests/sent | Donor/NGO | created by me |
| 30 | POST | /api/requests/<id>/accept | Responder | accept (atomic claim) |
| 31 | POST | /api/requests/<id>/reject | Responder | reject |
| 32 | POST | /api/requests/<id>/withdraw | Creator | withdraw |
| 33 | GET | /api/notifications | Any | list |
| 34 | GET | /api/notifications/unread-count | Any | bell badge |
| 35 | POST | /api/notifications/<id>/read | Any | mark one read |
| 36 | POST | /api/notifications/read-all | Any | mark all read |
| 37 | GET | /api/analytics/donor | Donor | donor statistics |
| 38 | GET | /api/analytics/ngo | NGO | NGO statistics |
| 39 | GET | /api/analytics/admin | Admin | platform statistics |
| 40 | GET | /api/admin/dashboard | Admin | overview + recent activity |
| 41 | GET | /api/admin/users | Admin | users (role/status/search) |
| 42 | POST | /api/admin/users/<id>/suspend | Admin | suspend (reason required) |
| 43 | POST | /api/admin/users/<id>/reactivate | Admin | reactivate |
| 44 | GET | /api/admin/ngos | Admin | NGOs by verification status |
| 45 | POST | /api/admin/ngos/<id>/verify | Admin | verify NGO |
| 46 | POST | /api/admin/ngos/<id>/reject | Admin | reject NGO (note required) |
| 47 | GET | /api/admin/donations | Admin | all donations |
| 48 | POST | /api/admin/donations/<id>/reject | Admin | remove donation (→ REJECTED) |
| 49 | GET | /api/admin/requests | Admin | all requests |
| 50 | GET | /api/admin/reports | Admin | reports |
| 51 | POST | /api/admin/reports/<id>/resolve | Admin | resolve/dismiss (+ optional removal) |
| 52 | GET | /api/admin/contact-messages | Admin | contact messages |
| 53 | GET | /api/admin/audit-logs | Admin | audit trail |

**Per blueprint:** admin 14 · donations 12 · requests 7 · profile 6 · analytics 6 · auth 4 · notifications 4 = **53** (50 unique URLs).

**Example: create a donation**
```
POST /api/donations
Authorization: Bearer eyJ...
{"food_name":"Veg biryani","category":"cooked_meals","quantity":10,"quantity_unit":"kg","servings":40,
 "dietary_type":"vegetarian","is_packaged":false,"storage_type":"room_temperature",
 "prepared_at":"2026-10-16T09:00:00Z","expires_at":"2026-10-16T14:00:00Z","pickup_deadline":"2026-10-16T13:00:00Z",
 "pickup_address":"12 LB Road","pickup_area":"Adyar","pickup_postal_code":"600020","safety_declaration":true}

→ 201 {"success":true,"message":"Donation published...","data":{"donation":{"id":18,"status":"AVAILABLE",...},"safety":{...}}}
→ 422 if expired: {"success":false,"error":{"code":"SAFETY_CHECK_FAILED","details":{"expires_at":"...already past its use-by..."}}}
```

---

## PART N — STEP-BY-STEP WORKFLOWS

### N1. Donor
1. **Log in:** `POST /auth/login` → token → `/donor`.
2. **Dashboard:** `GET /analytics/donor` + `GET /donations/mine?scope=active`.
3. **Donate food:** the form calls `POST /donations/safety-check` while typing, then submits `POST /donations`. The backend validates, checks safety, inserts into `donations` + `donation_status_history`, and returns 201.
4. **Matches page:** `GET /donations/<id>/matches` → `rank_ngos_for_donation()`.
5. **Offer** (optional): `POST /donations/<id>/offer` creates a `collection_requests` row (initiated_by=donor) → status REQUESTED → NGO notified.
6. **NGO requests:** `GET /requests/incoming` → accept with `POST /requests/<id>/accept` (atomic claim).
7. **Track:** `GET /donations/<id>`, polled every 15 s → timeline and checklist.
8. **Cancel / edit / history / notifications / profile** as needed.

### N2. NGO
1. **Register:** `POST /auth/register` (role ngo) → profile pending → admins notified.
2. Admin verifies → NGO notified.
3. **Recommended:** `GET /donations/recommended`. **Available** with filters: `GET /donations/available`.
4. **Request:** `POST /donations/<id>/requests` → REQUESTED → donor notified. Or accept a donor offer from `/requests/incoming`.
5. After the donor accepts: **Active collections** (`GET /donations/collections?scope=active`). The address and phone are now visible.
6. **Update:** `POST /donations/<id>/status` with PICKUP_SCHEDULED (time) → COLLECTED → DELIVERED (servings distributed). The donor is notified each time.
7. **Completed collections** and the dashboard show servings received and distributed.

### N3. Admin
1. **Dashboard:** `GET /admin/dashboard` → alerts for pending NGOs and open reports.
2. **Verify NGOs:** `POST /admin/ngos/<id>/verify` or `/reject` → notification + audit.
3. **Users:** suspend (blocked immediately, even with an old token) or reactivate.
4. **Donations:** inspect any donation; remove it with `POST /admin/donations/<id>/reject`.
5. **Reports:** resolve or dismiss, optionally removing the donation. **Contact messages:** read.
6. **Analytics** and **audit log.**

### N4. The full 16-step demo workflow (verified working)
1. Donor registers and logs in.
2. Creates a donation.
3. The backend validates it.
4. It is saved to SQLite.
5. Matching ranks verified NGOs.
6. The UI explains the scores.
7. An NGO logs in and views the donation.
8. The NGO requests it.
9. The donor accepts.
10. The donation becomes unavailable to other NGOs.
11. The NGO schedules the pickup.
12. The NGO marks it collected, then delivered.
13. Both sides see the timeline.
14. Notifications come from real events.
15. Dashboards update.
16. The admin inspects all of it.

Also verified: an expired donation is rejected (422), and a second NGO cannot claim the same donation (409).

---

## PART O — TESTING

**Command:** in `backend`, with the venv active, run `python -m pytest -q` → **54 passed**. The tests use a temporary in-memory database, so demo data is untouched.

| File | Tests | What they prove |
|---|---|---|
| test_matching.py | 13 | weights add to 100; perfect match = 100; total = sum of components; every scoring level; each exclusion (unverified, diet, storage, packaging, capacity, deadline); ranking order; same output on repeat runs; tie-breaks |
| test_food_safety.py | 9 | valid passes; expired blocked; deadline after expiry blocked; deadline too soon; future preparation; missing declaration; holding-time warning; urgent warning; API returns 422 for expired |
| test_auth.py | 13 | register + login; password hashed; duplicate email; no admin self-registration; weak password / bad email; wrong password; NGO starts pending; token required; logout revokes token; donor blocked from admin APIs; role separation; admin access; suspension blocks immediately + audit |
| test_donations.py | 19 | creation persisted with history; donor_id taken from token; missing / invalid fields; cannot cancel others' donations; matches API scores; request → REQUESTED + notifications; duplicate request; unverified NGO blocked; **two NGOs cannot both claim**; simulated race blocked by the atomic update; accepted donation hidden from others; NGO cannot accept its own request; donor offer → NGO accepts; rejection reopens the donation; transition table; full lifecycle + invalid jumps + wrong NGO/donor blocked; auto-expiry; analytics reflect the DB |

---

## PART P — DESIGN / UI

- **Look:** white and soft green palette, dark green primary buttons, rounded cards, Inter font.
- **Feedback:** loading spinners, empty states, success toasts, red error alerts, field-level error messages, confirmation dialogs for important actions.
- **Responsive:** the sidebar becomes a slide-in menu on phones; tables scroll inside cards; tested at phone width with no sideways scrolling.
- **Accessibility:** every input has a linked label, Escape closes dialogs, buttons have accessible names, and status badges have a hover description.
- **Honesty in the UI:**
  - "Area-based matching (not GPS)"
  - "Status tracking only – not live GPS"
  - estimates labelled "illustrative"
  - the safety disclaimer

---

## PART Q — LIMITATIONS & FUTURE WORK

| Current limitation | Future enhancement |
|---|---|
| area/PIN matching | geocoding + real distance (OpenStreetMap) |
| rule-based scoring | ML model trained on accepted/rejected matches (same output shape) |
| polling every 15–30 s | WebSockets / Server-Sent Events |
| in-app notifications only | email, SMS, WhatsApp |
| no GPS tracking | driver mobile app with location |
| opening hours stored but not scored | check the pickup window against opening hours |
| expiry checked when pages load | background scheduler (APScheduler/Celery) |
| food not weighed; impact estimated | record weight at pickup |
| JWT in localStorage | httpOnly cookies + CSRF |
| SQLite, no migrations | PostgreSQL + Flask-Migrate |
| no photos | image upload |
| NGO can't back out after acceptance | "release collection" flow |
| no donor rewards | impact certificates, badges, leaderboard, NGO thank-you notes, CSR report export |

**Why would restaurants donate?** Lower waste costs, CSR and brand reputation, customer goodwill, staff morale, and a measurable impact record for sustainability reports. Note: tax deductions for food given in kind generally don't apply in India, so don't claim them.

---

## PART R — TEAM DIVISION

| Member | Area | Main files | Demonstrates |
|---|---|---|---|
| **1 – Frontend & UX** | React app, routing, pages, forms, charts, API integration, responsive UI | `frontend/src/` (App.jsx, AuthContext, services/api.js, CreateDonationPage, MatchRecommendationsPage, DonationDetailsPage, layouts, components) | landing page, donor flow, recommendations UI, responsive design |
| **2 – Backend, Auth & DB** | Flask structure, APIs, JWT + roles, models, requests, notifications, transactions | `backend/app/__init__.py`, routes/, models/, utils/, collection_service.py, notification_service.py, seed.py | NGO request → donor accept → duplicate-claim protection → status updates; admin security |
| **3 – Matching, Safety & Analytics** | matching, safety, lifecycle, analytics, tests | matching.py, food_safety.py, lifecycle.py, analytics.py, tests/ | score worked example, exclusions, expired rejection, timeline, dashboards, pytest |

---

## PART S — DEMO PLAN (3 windows, 12 minutes)

**Setup:**
- Run `python seed.py`, then `python run.py`, then `npm run dev`.
- **Window A:** Chrome, donor (restaurant@).
- **Window B:** Chrome Incognito, NGO (helpinghands@).
- **Window D:** Edge, admin.

| Time | Who | Steps |
|---|---|---|
| 0:00–3:30 | Member 1 | Landing page and live stats → architecture diagram → A: Donate food (Vegetable pulao, 40 servings, Adyar 600020) → show an expired use-by error → publish → recommendations, score breakdown, excluded Green Plate (unpackaged) |
| 3:30–6:30 | Member 2 | B: Recommended for you → Request → A: bell → NGO requests → Accept (explain the atomic update + duplicate-claim test) → B: Active collections → Schedule pickup → Collected → Delivered (38) → explain JWT/roles |
| 6:30–9:30 | Member 3 | A: donation details → timeline (15 s polling, not GPS) + safety checklist → explain the two-stage matching + worked example (63) → lifecycle rules → dashboards updated (formulas) → `python -m pytest -q` (54 passed) |
| 9:30–11:00 | Member 2/3 | D: dashboard alerts → verify Little Lights → resolve the milk report → open the donation history → audit log; "non-admins get 403" |
| 11:00–12:00 | All | limitations, future work, questions |

**Optional extra:** open `foodconnect.db` in DB Browser and show the `donation_status_history` rows behind the timeline.

---

## PART T — QUICK VIVA ANSWERS

- **Architecture?** React → Axios JSON + JWT → Flask blueprints → services → SQLAlchemy → SQLite.
- **Why "AI"?** Automated, explainable, multi-criteria matching. Rule-based and honest about it; ML-ready.
- **Score formula?** Location 30 + capacity 20 + category 15 + dietary 15 + deadline 20, after hard filters.
- **Duplicate claims?** A conditional atomic UPDATE (`WHERE status='REQUESTED'`) plus UNIQUE(donation, NGO).
- **Security?** Hashed passwords, signed JWT, role and suspension reloaded from the DB on every call, ownership checks, token blocklist on logout, secrets in `.env`.
- **Expired food?** Blocked with 422 before saving; matching never sees it.
- **Real-time?** Polling every 15 s: status tracking, not GPS.
- **Analytics real?** Counts come from the DB; kg and CO₂ are labelled estimates.
- **How many APIs?** 53 endpoints in 7 blueprints.
- **How many tables?** 10.
- **How many tests?** 54, all passing.
- **Scaling?** PostgreSQL via `DATABASE_URL`, migrations, background jobs, WebSockets.
- **Biggest challenge?** Making sure two NGOs can't claim the same food, and that the score never overrides safety.

Other documents in `docs/`: PROJECT_EXPLANATION, DATABASE_EXPLANATION, API_EXPLANATION, MATCHING_ALGORITHM, DEMO_SCRIPT, VIVA_QUESTIONS (43 Q&As), TEAM_DIVISION, HANDOVER.
