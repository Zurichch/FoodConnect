# FoodConnect – Demonstration Script (10–12 minutes)

## Before the evaluation (15 minutes earlier)

1. `cd backend` → `venv\Scripts\activate` → **`python seed.py`** (fresh times — demo donations expire otherwise).
2. Terminal 1: `python run.py` · Terminal 2: `cd frontend` → `npm run dev`.
3. Open separate browser *sessions* so each role stays logged in. The login is stored per browser profile, so two normal tabs (or two incognito windows) share one login. Use e.g. Chrome normal, Chrome incognito, Edge normal and Edge InPrivate:
   - **Window A – Donor:** `restaurant@foodconnect.demo`
   - **Window B – NGO:** `helpinghands@foodconnect.demo` (second NGO for the duplicate-claim demo: `annanagar@foodconnect.demo` in another private window)
   - **Window C – Admin:** `admin@foodconnect.demo`
   (Passwords are in `backend/.env`, defaults in the README §16.)
4. Have a terminal ready for `python -m pytest -q`.
5. Zoom the browser to 110–125% so the audience can read it.

## Timeline

| Time | Speaker | What to show |
|---|---|---|
| 0:00–1:00 | All (Member 1 leads) | Problem + solution on the landing page |
| 1:00–4:30 | Member 1 | Donor flow: create donation, safety panel, recommendations |
| 4:30–7:00 | Member 2 | NGO flow: request, donor accepts, duplicate-claim protection, status updates |
| 7:00–9:30 | Member 3 | Matching explanation, timeline, analytics, expiry rejection, tests |
| 9:30–11:00 | Member 2 / 3 | Admin: verification, moderation, audit log |
| 11:00–12:00 | All | Limitations, future work, questions |

## Step-by-step

### 1. Landing page (Member 1, ~1 min)
- "Restaurants and canteens throw away edible food while shelters nearby need it. Coordination happens over calls and groups."
- Scroll: **live statistics** — "these numbers are counted from our database, not typed in"; the kg value is labelled as an illustrative estimate.
- Show the three steps, the 100-point weights, and the lifecycle.

### 2. Donor creates a donation (Member 1, ~2 min)
Window A → **Donate food**.
- Fill: *Vegetable pulao*, Cooked meals, Vegetarian, 10 kg, **40 servings**, Unpackaged, Room temperature, allergens "none". Times are pre-filled (prepared 1 h ago, use-by in 5 h, pickup in 4 h). Area **Adyar**, PIN **600020**.
- Point at the **Food safety check** panel: it updates live from the backend. Show a warning (e.g. change use-by to +10 h → "double-check" warning, then change it back).
- **Show rejection:** set *Use-by* to one hour **ago** → the panel shows a red error; tick the declaration and click Publish → error "already past its use-by time". Change it back to a future time.
- Tick the declaration → **Publish & find NGOs**.

### 3. Recommendations (Member 1 → Member 3, ~1.5 min)
- Ranked NGO cards with a score out of 100. Open **"See how the score was calculated"** on #1: five bars, each with a reason.
- Scroll to **"Verified NGOs not recommended"**: Green Plate Shelter excluded because it does not accept unpackaged food → "a high score can never override a safety or handling rule".
- Member 3 explains one score by hand (see MATCHING_ALGORITHM.md).

### 4. NGO requests the donation (Member 2, ~1 min)
Window B (Helping Hands) → **Recommended for you** → the new pulao donation is at the top with its score → **Request** → add a message → Send.
- Optional: second NGO window (Anna Nagar) → **Available donations** → filter Area "Adyar" → **Request** the same donation.
- Point out: NGOs only see area and PIN — the exact address (and exact map pin) is shown after acceptance.

### 4b. Donations map (Member 1 or 2, ~30 s)
Window B → **Donations map**: coloured markers by urgency (red < 2 h, amber < 6 h, green later), your NGO base, list sorted by deadline. Click a list item → the map flies there; click a marker → popup with *View details*.
- "Other NGOs only see the **approximate area** (faint circle). The exact pin appears only after the donor accepts — same privacy rule as the address."
- "It's OpenStreetMap via Leaflet: free, no API key. It shows where food is waiting, not GPS tracking."

### 5. Donor accepts (Member 2, ~1 min)
Window A → bell shows a new notification → **NGO requests** → *Requests from NGOs* → **Accept** Helping Hands.
- **Duplicate-claim demo:** try to accept the Anna Nagar request → it is already *rejected* automatically ("another NGO was selected"). If you are fast, accepting it gives **"already been claimed by another NGO"** (409). Explain the atomic `UPDATE … WHERE status='REQUESTED'`.
- Anna Nagar window: the donation is gone from *Available donations*.

### 6. NGO updates the collection (Member 2, ~1 min)
Window B → **Active collections** → **Update status** → **Schedule pickup** (pick a time before the deadline) → **Mark as collected** → **Mark as delivered** (servings distributed: 38).
- Window A's details page auto-refreshes within 15 s: the **timeline** fills step by step, and the history shows who did what and when.
- Say clearly: "This is status tracking by polling every 15 seconds, not GPS tracking."

### 7. Analytics (Member 3, ~1 min)
- Window A → **Dashboard**: delivered count and servings recovered increased. Explain the formulas (servings recovered = collected + delivered; completion rate = delivered ÷ closed donations).
- Window B → **Dashboard**: servings received/distributed.

### 8. Admin (Member 2/3, ~1.5 min)
Window C:
- **Dashboard** → pending NGO and open report alerts.
- **NGO verification** → *Little Lights Children's Home* (pending) → **Verify** → (it can now appear in recommendations).
- **Reports & moderation** → open report on *Toned milk packets* → Review → Dismissed / Resolved with a note.
- **Donations** → open the pulao donation → full timeline and both requests.
- **Audit log** → the actions you just did are listed.
- **Security point:** log in as a donor and open `/admin` → redirected; calling `/api/admin/users` with a donor token returns **403** (shown in the tests).

### 9. Tests (Member 3, ~30 s)
```bash
python -m pytest -q
```
→ `63 passed`. Mention test names: `test_two_ngos_cannot_both_claim_the_same_donation`, `test_api_rejects_expired_donation`, `test_full_lifecycle_and_invalid_jumps`.

### 10. Close (All, ~1 min)
- Limitations: area-based not GPS; rule-based scoring; polling; app cannot certify food safety; estimates labelled.
- Future: distance-based matching, ML on past matches, SMS/email alerts, mobile app with live pickup tracking, PostgreSQL deployment.

## Backup plan
- If something breaks, run `python seed.py` and refresh the browsers (everyone must log in again).
- If the frontend fails, demonstrate the API with the PowerShell commands in API_EXPLANATION.md §4 and run the tests.
- Keep screenshots of each step in a folder as a last resort.
