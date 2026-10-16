# FoodConnect – Team Division and Presentation Plan

Three members, three clear areas that map to real folders. Everyone should still be able to explain the end-to-end flow in [PROJECT_EXPLANATION.md](PROJECT_EXPLANATION.md) §2.

| | Member 1 | Member 2 | Member 3 |
|---|---|---|---|
| **Area** | Frontend & user experience | Backend, authentication & database | Intelligent matching, safety & analytics |
| **Main folders** | `frontend/src/` | `backend/app/routes/`, `models/`, `utils/`, `services/collection_service.py`, `services/notification_service.py` | `backend/app/services/matching.py`, `food_safety.py`, `lifecycle.py`, `analytics.py`, `backend/tests/` |
| **Demo part** | Landing page, donor flow, recommendations UI | NGO request, accept, duplicate-claim protection, status updates, admin security | Score explanation, safety rules, timeline, analytics, tests |

---

## Member 1 — Frontend and User Experience

### Responsibilities
React structure, routing, landing/public pages, login/registration, donor & NGO dashboards, forms, tables, cards, filters, charts, API integration, responsive styling, accessibility.

### Important files
| File | Why it matters |
|---|---|
| `frontend/src/main.jsx`, `App.jsx` | Entry point; all routes and role protection |
| `src/context/AuthContext.jsx`, `hooks/useAuth.js` | Who is logged in; login/register/logout |
| `src/services/api.js` | Axios instance, token interceptor, error messages |
| `src/services/*Service.js` | One function per API endpoint |
| `src/hooks/useApi.js` | Loading/error states and polling |
| `src/components/ProtectedRoute.jsx` | Role-based page access (UX only) |
| `src/layouts/DashboardLayout.jsx` | Sidebar per role, notification bell polling |
| `src/pages/public/LandingPage.jsx` | Live stats from `/api/public/stats` |
| `src/pages/public/RegisterPage.jsx` | Donor/NGO registration form |
| `src/pages/donor/CreateDonationPage.jsx` | Biggest form; live safety preview |
| `src/pages/donor/MatchRecommendationsPage.jsx`, `components/MatchCard.jsx` | Shows backend scores |
| `src/pages/shared/DonationDetailsPage.jsx`, `components/DonationTimeline.jsx` | Tracking page |
| `src/pages/ngo/AvailableDonationsPage.jsx` | Filters → query parameters |
| `src/components/Charts.jsx` | Recharts dashboards |
| `src/utils/validation.js`, `format.js`, `constants.js` | Form checks, dates, labels |

### Functions/concepts to understand
`useState`, `useEffect`, props, controlled inputs (`value` + `onChange`), `useApi()` (and `pollMs`), `unwrap()` / `getErrorMessage()` / `getFieldErrors()`, `AuthProvider.login()`, `ProtectedRoute`, `toPayload()` + `inputToIso()` (local time → UTC), `ConfirmDialog` usage, Tailwind classes in `index.css` (`btn-primary`, `card`, `input`).

### What to demonstrate
Landing page with live stats → register/login → donor dashboard → create donation (live safety panel, validation errors) → recommendations page with score breakdown → responsive layout (shrink the window / phone view).

### Presentation script (~3 minutes)
> "I built the frontend in React with Vite and Tailwind. The landing page explains the problem and shows live statistics — these numbers come from our database through `/api/public/stats`.
> All pages are registered in `App.jsx`. Pages for donors, NGOs and admins are wrapped in `ProtectedRoute`, which checks the logged-in user's role. This is only for user experience — the backend checks permissions again on every call.
> Pages never call the server directly. They call small functions in `src/services`, which use one Axios instance. Its interceptor attaches the login token to every request, and if the server says the token expired, the user is logged out everywhere.
> Here is the donation form. I validate in the browser for instant feedback, and while the donor types, the safety panel calls `/api/donations/safety-check`, so the warnings come from the real backend rules. Times are typed in local time and converted to UTC before sending.
> After publishing, we land on the recommendations. React does not calculate anything here — every score, bar and sentence comes from the backend's matching algorithm. Member 3 will explain how it is calculated.
> The layout is responsive: the sidebar becomes a menu on phones, and tables scroll inside their cards. Forms have labels linked to inputs, and dialogs close with Escape for keyboard users."

---

## Member 2 — Backend, Authentication and Database

### Responsibilities
Flask structure, REST endpoints, authentication and role-based access, SQLAlchemy models and relationships, donation CRUD, NGO profiles, collection requests, notifications, status history storage, validation, transaction safety.

### Important files
| File | Why it matters |
|---|---|
| `backend/run.py`, `config.py`, `.env.example` | Starting the server, settings, secrets |
| `app/__init__.py` | `create_app()`, blueprints, JSON error handlers, JWT callbacks |
| `app/extensions.py` | `db`, `jwt`, SQLite foreign keys |
| `app/models/*.py` | Tables and relationships |
| `app/utils/auth_helpers.py` | `auth_required()` decorator |
| `app/utils/validators.py`, `responses.py` | Input checks, `ApiError`, response format, pagination |
| `app/routes/auth_routes.py` | Register/login/logout |
| `app/routes/donation_routes.py` | Donation endpoints, visibility rules |
| `app/routes/request_routes.py` + `services/collection_service.py` | Requests, offers, **atomic accept** |
| `app/routes/admin_routes.py` | Admin endpoints + audit log |
| `app/services/notification_service.py` | `notify_user`, `record_audit` |
| `seed.py` | Demo data |

### Functions/concepts to understand
`create_app()`, Blueprints, `auth_required(*roles)`, `create_access_token()` and `get_jwt_identity()`, `set_password()` / `check_password()`, `TokenBlocklist`, `ApiError` + error handler, `read_string()` / `raise_if_errors()`, `db.session.add/commit/rollback`, relationships (`back_populates`, `uselist=False`, `cascade`), `create_ngo_request()`, `accept_collection_request()` (conditional `update()` and `rowcount`), `can_view_donation()`, `paginate_query()`.

### What to demonstrate
NGO login → request a donation → donor accepts → second NGO cannot claim (409) → NGO schedules/collects/delivers → admin verifies an NGO, suspends a user, sees the audit log → a donor token gets 403 on admin APIs.

### Presentation script (~3 minutes)
> "I built the Flask backend. `create_app()` loads settings from `.env`, connects SQLAlchemy and JWT, registers one blueprint per area and makes every error return the same JSON shape.
> Passwords are stored only as hashes. At login we create a signed JWT containing the user id. Every protected route uses my `auth_required` decorator: it verifies the token, then loads the user from the database, so the role and suspension status always come from the database — never from the browser. Logging out stores the token id in a blocklist.
> The database has User, NGOProfile, Donation, CollectionRequest, status history, notifications and audit logs. A user has one NGO profile; a donor has many donations; a donation has many requests and history rows.
> Now the most important safety feature: two NGOs requested this donation. When the donor accepts one, I run a single conditional UPDATE — 'set ACCEPTED where the status is still REQUESTED and no NGO is assigned'. The database does this atomically, so only one call can change the row; the other gets a 409 'already claimed'. The other requests are closed and those NGOs are notified, all in one transaction.
> The assigned NGO can now move the donation forward. Each change is stored in the history table and creates notifications for the donor.
> Admin routes all require the admin role. Here a donor token gets 403, and every admin action is written to the audit log."

---

## Member 3 — Intelligent Matching, Safety and Analytics

### Responsibilities
Explainable matching and ranking, food expiry/safety validation, lifecycle rules and tracking, dashboard analytics and formulas, matching tests and integration tests, impact calculations.

### Important files
| File | Why it matters |
|---|---|
| `backend/app/services/matching.py` | Hard filters, five scoring functions, ranking, explanations |
| `backend/app/services/food_safety.py` | Blocking errors, warnings, checklist, disclaimer |
| `backend/app/services/lifecycle.py` | `ALLOWED_TRANSITIONS`, `change_status`, lazy expiry |
| `backend/app/services/analytics.py` | Summary formulas, monthly trends, categories, NGO activity, estimates |
| `backend/tests/test_matching.py`, `test_food_safety.py`, `test_donations.py`, `test_auth.py` | 54 tests |
| `docs/MATCHING_ALGORITHM.md` | Worked examples |

### Functions/concepts to understand
`WEIGHTS`, `find_exclusion_reasons()`, `score_location/capacity/category/dietary/deadline()`, `calculate_match_score()`, `rank_ngos_for_donation()`, `rank_donations_for_ngo()`, `get_available_capacity()`, `check_food_safety()`, `build_safety_checklist()`, `can_transition()`, `change_status()`, `expire_overdue_donations()`, `build_summary()`, `estimate_impact()`, pytest fixtures in `conftest.py`.

### What to demonstrate
Open a recommendation's score breakdown and calculate it by hand → show an excluded NGO and why → show the expired donation being rejected → show the timeline and an invalid transition (409) → dashboards updating after delivery → run `python -m pytest -q`.

### Presentation script (~3 minutes)
> "I built the decision logic. Matching has two stages. First, hard filters: an NGO is excluded if it is not verified, breaks a declared dietary or storage rule, has less free capacity than the servings, cannot reach the donor before the deadline, or is outside the postal district. These are safety and feasibility rules, so no score can override them.
> Second, the remaining NGOs get a score out of 100: location 30, capacity 20, category 15, diet 15, deadline 20. For example [open a card]: same postal district 15, capacity 1.5 times the servings gives 15, category not preferred 6, a prefers-vegetarian NGO receiving non-veg food 7, and 4.5 hours to spare gives 20 — total 63. The explanation sentence is built from the same reasons, so it always matches the score. The algorithm is deterministic, and ties are broken by spare capacity and then name.
> Location is area- and PIN-based, not GPS, and we label it that way.
> Food safety runs before matching. Expired food, a pickup deadline after the use-by time, or a deadline less than 30 minutes away are blocked with a 422 error — here is the rejection. Softer risks become warnings shown to NGOs, and we show a disclaimer because we cannot certify food.
> The lifecycle is one table of allowed transitions. Skipping from accepted to delivered returns 409. Overdue donations are expired automatically whenever lists are loaded. The timeline polls every 15 seconds — status tracking, not GPS.
> Analytics are computed from the database: servings recovered are collected plus delivered servings; completion rate is delivered divided by closed donations. The kilogram and CO₂ values are clearly labelled estimates.
> Finally, the tests: 54 pass, including 'two NGOs cannot both claim the same donation' and 'expired donation rejected'."

---

## How the three parts connect (end-to-end)

```
Member 1 (React)                 Member 2 (Flask + DB)                       Member 3 (rules)
CreateDonationPage ──POST──►  donation_routes.create_donation ──calls──►  food_safety.check_food_safety
                                       │ saves Donation + history (models)
MatchRecommendationsPage ◄──GET── /matches ─────────────────calls──►  matching.rank_ngos_for_donation
RequestsPage (accept) ──POST──►  collection_service.accept (atomic) ─►  lifecycle.add_history_entry
DonationDetailsPage (poll) ◄─GET─ donation details + history ◄──────── lifecycle.expire_overdue_donations
Dashboards ◄──GET── analytics routes ──────────────────────────calls──►  analytics.build_summary
```

## Combined 10–12 minute presentation

| Time | Who | Content |
|---|---|---|
| 0:00–1:00 | Member 1 | Problem, solution, landing page with live stats |
| 1:00–3:30 | Member 1 | Architecture diagram (README §8), donor creates donation, safety panel, recommendations UI |
| 3:30–6:30 | Member 2 | Auth & roles, database model diagram, NGO request → donor accept → duplicate-claim 409 → status updates |
| 6:30–9:30 | Member 3 | Score worked example, exclusions, expired rejection, lifecycle/timeline, analytics, tests |
| 9:30–11:00 | Member 2 | Admin: verify NGO, moderation, audit log, 403 for non-admins |
| 11:00–12:00 | All | Limitations (area-based, rule-based, polling, no food certification), future work, thanks |

Rehearse with the detailed click-by-click steps in [DEMO_SCRIPT.md](DEMO_SCRIPT.md) and revise [VIVA_QUESTIONS.md](VIVA_QUESTIONS.md) together — each member should be able to answer at least the "General" and "Architecture" questions.
