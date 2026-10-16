# FoodConnect – Project Explanation (for beginners)

This document explains the *whole* project as if you have never built a full-stack application before. Read it once from top to bottom before the viva.

---

## 1. What is a "full-stack" application?

A full-stack app has three parts that talk to each other:

| Part | In FoodConnect | Job |
|---|---|---|
| **Frontend** | React in `frontend/` | What the user sees and clicks in the browser. |
| **Backend** | Flask in `backend/` | Receives requests, checks permissions, applies rules, talks to the database. |
| **Database** | SQLite file `backend/instance/foodconnect.db` | Stores everything permanently. |

The frontend **never** touches the database directly. It always asks the backend through an **API** (Application Programming Interface): a list of URLs such as `POST /api/donations` that accept and return **JSON**.

## 2. A complete journey: "Donor publishes food"

1. The donor fills the form in `CreateDonationPage.jsx` and clicks **Publish & find NGOs**.
2. `validateDonation()` in `src/utils/validation.js` does quick browser checks (empty fields, obvious date problems).
3. `createDonation(form)` in `src/services/donationService.js` calls `api.post('/donations', form)`.
4. `src/services/api.js` (Axios) adds the header `Authorization: Bearer <token>`.
5. Vite's proxy (`vite.config.js`) forwards `/api/donations` to `http://127.0.0.1:5000/api/donations`.
6. Flask finds the matching route `create_donation()` in `backend/app/routes/donation_routes.py`.
7. `@auth_required("donor")` checks the token, loads the user **from the database**, and confirms the role is donor and the account is not suspended.
8. `parse_donation_form()` validates every field again (never trust the browser). Problems → **400** with a message per field.
9. `check_food_safety()` in `services/food_safety.py` checks the times. Expired or impossible → **422**.
10. A `Donation` object is created with `donor_id = the logged-in user's id` (not from the form), plus a first `DonationStatusHistory` row.
11. `db.session.commit()` saves both rows in one **transaction**.
12. Flask returns `201 Created` with `{success: true, data: {donation, safety}}`.
13. React navigates to `/donor/donations/<id>/matches`, which calls `GET /api/donations/<id>/matches`.
14. `rank_ngos_for_donation()` in `services/matching.py` scores every NGO and the page shows the ranked cards with explanations.

If you can explain these 14 steps you understand the architecture.

## 3. The backend, folder by folder

| Folder/file | What it contains | Analogy |
|---|---|---|
| `run.py` | Starts the server | The power switch |
| `config.py` | Settings read from `.env` | The settings page |
| `app/__init__.py` | `create_app()` connects everything | The assembly line |
| `app/models/` | Database tables as Python classes | The filing cabinet design |
| `app/routes/` | URL endpoints (blueprints) | The reception desk |
| `app/services/` | Business rules (matching, safety, lifecycle...) | The experts in the back office |
| `app/utils/` | Helpers (validation, JSON responses, auth decorator) | The toolbox |
| `seed.py` | Demo data | Sample files for the demo |
| `tests/` | Automated tests | The quality inspector |

**Rule we followed:** routes are *thin* (read input, check who is calling, call a service, return JSON). The interesting logic is in `services/`, so each rule lives in exactly one place.

## 4. The frontend, folder by folder

| Folder | Contents |
|---|---|
| `main.jsx` | Starts React, wraps the app in the router and `AuthProvider`. |
| `App.jsx` | Every URL → page mapping, and which roles may open it. |
| `context/AuthContext.jsx` | Remembers the logged-in user; `login()`, `logout()`, `register()`. |
| `services/` | One file per API area. Pages never call Axios directly. |
| `hooks/useApi.js` | Loads data with `isLoading`/`error` states and optional polling. |
| `layouts/` | `PublicLayout` (top navbar + footer) and `DashboardLayout` (sidebar + bell). |
| `components/` | Reusable pieces: `StatusBadge`, `DonationCard`, `MatchCard`, `DonationTimeline`, `SafetyChecklist`, `ConfirmDialog`, `ui.jsx` (buttons, alerts, cards...). |
| `pages/` | One file per screen, grouped by `public`, `donor`, `ngo`, `admin`, `shared`. |
| `utils/` | Labels for statuses/categories, date formatting, form validation. |

## 5. How authentication works

1. **Register:** password → `generate_password_hash()` → only the hash is stored. A hash is one-way: you cannot turn it back into the password.
2. **Login:** the typed password is hashed again and compared with `check_password_hash()`.
3. If correct, the server creates a **JWT** (JSON Web Token) containing the user id, **signed** with `JWT_SECRET_KEY`. Anyone can read a JWT, but nobody can change it without the secret, because the signature would no longer match.
4. React stores the token in `localStorage` and sends it with every request.
5. `auth_required()` verifies the signature and expiry, then **loads the user from the database** and checks role and suspension. This is why a suspended user is blocked immediately even though their token has not expired.
6. **Logout:** the token's unique id (`jti`) is stored in `TokenBlocklist`; any later request with it gets `401 TOKEN_REVOKED`.
7. In the browser, `ProtectedRoute` hides pages from the wrong roles. This is only for convenience — **the backend checks again on every request**, so hiding a button is never the security mechanism.

## 6. How authorization (permissions) works

| Check | Where |
|---|---|
| Is the user logged in? | `verify_jwt_in_request()` inside `auth_required` |
| Does the role match? | `auth_required("donor")`, `auth_required("ngo")`, `auth_required("admin")` |
| Does the donor own this donation? | `if donation.donor_id != donor.id: 403` in donation routes |
| Is this the assigned NGO? | `if donation.assigned_ngo_id != ngo.id: 403` in the status route |
| Can this user accept this request? | `user_is_responder()` in `collection_service.py` |
| Is the NGO verified? | request route + matching exclusion |

## 7. How the main features fit together

```
Donor creates donation ──► food_safety.py (block or warn)
        │
        ▼
matching.py ranks verified NGOs ──► donor offers to an NGO ─┐
                                                            ├─► CollectionRequest (pending)
NGO browses / recommended list ──► NGO requests ────────────┘
        │
        ▼
Receiving party accepts ──► collection_service.accept_collection_request()
        │                    (atomic UPDATE: only one NGO can win)
        ▼
lifecycle.py: ACCEPTED → PICKUP_SCHEDULED → COLLECTED → DELIVERED
        │        (each step: history row + notifications)
        ▼
analytics.py counts the rows ──► dashboards and landing page
```

## 8. "Near-real-time" tracking

There is no WebSocket. Pages that need fresh data use `useApi(..., { pollMs: 15000 })`, which re-fetches every 15 seconds. The bell in the top bar asks `/api/notifications/unread-count` every 20 seconds. This is simple, reliable and good enough for a demo. It is **status** tracking, not **GPS** tracking.

## 9. Honest limitations to mention

- Area/postal-code matching, not GPS distance.
- Rule-based "AI" (explainable scoring), not a trained machine-learning model — but structured so one can be added (`calculate_match_score` is the plug-in point).
- Safety checks are based on what the donor types; the app does not certify food.
- Impact numbers (kg, CO₂e) are illustrative estimates.
