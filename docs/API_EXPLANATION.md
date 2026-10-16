# FoodConnect – API Explanation

Base URL (development): `http://127.0.0.1:5000/api` — the React app reaches it as `/api` through the Vite proxy.

## 1. Conventions

- Request and response bodies are **JSON**.
- Protected endpoints need the header `Authorization: Bearer <token>` (token from login/register).
- Times are **UTC ISO strings** ending in `Z`, e.g. `2026-10-15T14:30:00Z`. The browser converts to local time.
- Lists are paginated: `?page=1&per_page=10` → `{"items": [...], "page": 1, "per_page": 10, "total": 42, "pages": 5}`.

**Success**
```json
{ "success": true, "message": "Request accepted.", "data": { } }
```
**Error**
```json
{ "success": false, "error": { "code": "ALREADY_CLAIMED", "message": "This donation has already been claimed by another NGO.", "details": {} } }
```

| HTTP code | Meaning in FoodConnect | Example error codes |
|---|---|---|
| 400 | Invalid input | `VALIDATION_ERROR`, `INVALID_JSON` |
| 401 | Not logged in / bad token | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_REVOKED` |
| 403 | Logged in but not allowed | `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `NGO_NOT_VERIFIED` |
| 404 | Not found | `NOT_FOUND` |
| 409 | Conflicts with current state | `INVALID_STATUS_TRANSITION`, `ALREADY_CLAIMED`, `DUPLICATE_REQUEST`, `DONATION_NOT_AVAILABLE` |
| 422 | Rule check failed | `SAFETY_CHECK_FAILED`, `NOT_ELIGIBLE`, `CAPACITY_EXCEEDED`, `FOOD_EXPIRED` |
| 500 | Unexpected server error (logged on the server) | `SERVER_ERROR` |

## 2. Route files

| File | Prefix | Area |
|---|---|---|
| `routes/auth_routes.py` | `/api/auth` | register, login, logout, me |
| `routes/profile_routes.py` | `/api` | profile, password, NGO profile, NGO dashboard |
| `routes/donation_routes.py` | `/api/donations` | create, list, details, edit, cancel, matches, NGO lists, status updates, reports |
| `routes/request_routes.py` | `/api` | requests, offers, accept/reject/withdraw |
| `routes/notification_routes.py` | `/api/notifications` | notifications |
| `routes/admin_routes.py` | `/api/admin` | admin management |
| `routes/analytics_routes.py` | `/api` | analytics, public stats, contact, health |

## 3. Endpoints with examples

### Authentication
**POST `/api/auth/register`** – Public
```json
{ "role": "donor", "name": "Campus Cafe", "email": "cafe@example.com", "password": "Secret123",
  "phone": "9876500000", "area": "Besant Nagar", "postal_code": "600090", "donor_type": "canteen" }
```
NGO registration adds `organization_name`, `service_areas` (list or comma text), `postal_codes`, `max_capacity_servings`, optional `pickup_lead_time_minutes`, `dietary_preference`, `preferred_categories`, `can_store_refrigerated`, `can_store_frozen`, `accepts_unpackaged`.
→ `201 { data: { token, user } }`. Duplicate email → `400` with `details.email`. Role `admin` → `400`.

**POST `/api/auth/login`** – `{ "email": "...", "password": "..." }` → `200 { data: { token, user } }`, wrong details → `401 INVALID_CREDENTIALS`, suspended → `403`.

**POST `/api/auth/logout`** – Any → token is blocklisted.
**GET `/api/auth/me`** – Any → current user (+ `ngo_profile` for NGOs).

### Profile
- **GET/PUT `/api/profile`** – `{ name, phone, area, postal_code, address, donor_type }`. Email and role cannot be changed.
- **PUT `/api/profile/password`** – `{ current_password, new_password }`.
- **GET/PUT `/api/ngo/profile`** (NGO) – organisation, `service_areas`, `postal_codes`, `max_capacity_servings`, `pickup_lead_time_minutes`, `preferred_categories`, `dietary_preference`, `opening_time`, `closing_time`, storage flags, optional `request_reverification` (if rejected).
- **GET `/api/ngo/dashboard`** (NGO) – `{ profile, summary, available_capacity, monthly_trends, categories }`.

### Donations (donor)
- **POST `/api/donations/safety-check`** – same fields as create; returns `{ errors, warnings, is_publishable, disclaimer }` without saving.
- **POST `/api/donations`** – create (example in README §17). Expired example:
  ```json
  422 { "success": false, "error": { "code": "SAFETY_CHECK_FAILED",
        "message": "This donation failed the food safety checks and cannot be published.",
        "details": { "expires_at": "This food is already past its use-by / expiry time and cannot be donated." } } }
  ```
- **GET `/api/donations/mine?scope=active|history|all&status=&search=&page=`** – own donations; each item has `pending_requests`.
- **PUT `/api/donations/<id>`** – edit; only `AVAILABLE` with no requests, else `409 NOT_EDITABLE`.
- **POST `/api/donations/<id>/cancel`** – `{ "reason": "..." }`; allowed from AVAILABLE/REQUESTED/ACCEPTED/PICKUP_SCHEDULED.
- **GET `/api/donations/<id>/matches`** – response:
  ```json
  { "weights": {"location":30,"capacity":20,"category":15,"dietary":15,"deadline":20},
    "location_basis": "Area-based matching ... not a GPS distance.",
    "recommendations": [ { "rank": 1, "score": 100, "ngo": {"id": 1, "organization_name": "Helping Hands Food Bank", "...": "..."},
        "components": [ {"key":"location","label":"Location / service area","points":30,"max_points":30,"reason":"serves the pickup area (Besant Nagar)"} ],
        "explanation": "Recommended because the NGO serves the pickup area (Besant Nagar), ...",
        "available_capacity": 250, "existing_request": null } ],
    "excluded": [ { "ngo": {"organization_name": "Green Plate Shelter"}, "exclusion_reasons": [{"code":"PACKAGING","reason":"NGO does not accept unpackaged food"}] } ] }
  ```
- **POST `/api/donations/<id>/offer`** – `{ "ngo_id": 1, "message": "optional" }`; NGO must be eligible (else `422 NOT_ELIGIBLE`).

### Donations (NGO)
- **GET `/api/donations/available`** – filters: `area`, `my_area=true`, `category`, `dietary_type`, `storage_type`, `min_servings`, `max_servings`, `deadline_within_hours`, `sort=deadline|newest|servings`, `page`. Each item has `already_requested`. Exact address is not included.
- **GET `/api/donations/recommended`** – `{ items: [{ donation, score, components, explanation }], available_capacity }`; empty with a message if the NGO is not verified.
- **GET `/api/donations/collections?scope=active|completed`** – donations assigned to this NGO (with address and donor phone).
- **POST `/api/donations/<id>/requests`** – `{ "message": "optional" }` → `201`. Errors: not verified `403`, duplicate `409`, closed donation `409`, capacity/storage/diet rule `422`.
- **POST `/api/donations/<id>/status`** – assigned NGO only:
  ```json
  { "status": "PICKUP_SCHEDULED", "scheduled_pickup_at": "2026-10-15T15:00:00Z", "note": "Van #2" }
  { "status": "COLLECTED", "note": "Picked up 2 vessels" }
  { "status": "DELIVERED", "servings_distributed": 38 }
  ```
  Skipping a step → `409 INVALID_STATUS_TRANSITION` with `details.allowed_next`.

### Shared
- **GET `/api/donations/<id>`** – `{ donation, history, requests, safety_checklist, safety_disclaimer, normal_flow, allowed_actions, tracking_note, server_time }`. Visible to the owner, admins, the assigned NGO, NGOs with a request on it, and any NGO while it is open. Address/phone only for owner, assigned NGO and admin.
- **POST `/api/donations/<id>/report`** – `{ "reason": "..." }` (not your own donation).

### Collection requests
- **GET `/api/requests/incoming?status=pending|accepted|rejected|withdrawn|all`** – donor: NGO requests for my food; NGO: donor offers to me.
- **GET `/api/requests/sent`** – what I created.
- **POST `/api/requests/<id>/accept`** `{ "note": "optional" }` – only the receiving party; returns `409 ALREADY_CLAIMED` if another NGO won.
- **POST `/api/requests/<id>/reject`** `{ "note": "optional" }`.
- **POST `/api/requests/<id>/withdraw`** – only the creator.

### Notifications
`GET /api/notifications?unread=true&page=` · `GET /api/notifications/unread-count` → `{ unread: 3 }` · `POST /api/notifications/<id>/read` · `POST /api/notifications/read-all`.

### Analytics & public
`GET /api/analytics/donor` · `/ngo` · `/admin` → `{ summary, monthly_trends, categories, ... }`
`GET /api/public/stats` → `{ completed_donations, servings_recovered, total_donations, verified_ngos, active_donors, impact_estimate, matching_weights }`
`POST /api/public/contact` → `{ name, email, subject, message }`
`GET /api/health`

### Admin (all require role admin; non-admins get 403)
| Endpoint | Body | Effect |
|---|---|---|
| `GET /admin/dashboard` | – | summary, users, trends, recent activity, open reports |
| `GET /admin/users?role=&status=&search=` | – | user list |
| `POST /admin/users/<id>/suspend` | `{reason}` | suspend + audit (admins cannot be suspended) |
| `POST /admin/users/<id>/reactivate` | – | reactivate + audit |
| `GET /admin/ngos?status=pending` | – | NGO list |
| `POST /admin/ngos/<id>/verify` | `{note?}` | verify + notify + audit |
| `POST /admin/ngos/<id>/reject` | `{note}` | reject + notify + audit |
| `GET /admin/donations?status=&search=` | – | all donations |
| `POST /admin/donations/<id>/reject` | `{reason}` | status → REJECTED + audit |
| `GET /admin/requests?status=` | – | all requests |
| `GET /admin/reports?status=open` | – | reports |
| `POST /admin/reports/<id>/resolve` | `{outcome: resolved|dismissed, note, reject_donation?}` | close report |
| `GET /admin/contact-messages` | – | contact messages |
| `GET /admin/audit-logs?action=` | – | audit trail |

## 4. Trying the API yourself

PowerShell example:
```powershell
$login = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5000/api/auth/login -ContentType 'application/json' -Body '{"email":"restaurant@foodconnect.demo","password":"DemoUser@2026"}'
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Invoke-RestMethod -Uri http://127.0.0.1:5000/api/donations/mine -Headers $headers
```
