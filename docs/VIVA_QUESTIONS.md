# FoodConnect – Likely Viva Questions and Answers

Answers are short so they can be spoken. File references show where to point if the examiner asks to see code.

## A. General

**1. What problem does FoodConnect solve?**
Edible surplus food is wasted because donors cannot quickly find an NGO that serves their area, has space, accepts that food and can collect before it spoils. FoodConnect lists the food, checks time-based safety rules, ranks suitable verified NGOs with explanations and tracks the donation until delivery.

**2. Why is it called "AI-enabled"?**
It automates a multi-criteria decision (which NGO fits best) with an explainable weighted-scoring algorithm. We are honest that it is rule-based, not a trained ML model, and it is designed so an ML model can replace `calculate_match_score` later.

**3. Why not use ChatGPT or another AI API?**
It costs money, needs keys and internet, gives non-deterministic answers that are hard to explain, and could "hallucinate" safety information. Our scoring is free, offline, deterministic and fully explainable.

**4. Who are the users?** Donors, NGOs, administrators — each with different pages and backend permissions.

## B. Architecture & frontend

**5. Explain the architecture.** React frontend (Vite) → HTTP JSON → Flask REST API → SQLAlchemy → SQLite. Frontend never touches the database.

**6. How does React talk to Flask?** Pages call functions in `src/services/*.js`, which use one Axios instance (`api.js`). An interceptor adds the JWT. In development Vite proxies `/api` to port 5000.

**7. What is a component? Give an example.** A reusable piece of UI. `StatusBadge` shows a coloured status pill and is used on many pages.

**8. What is a hook? Which custom hooks did you write?** A function that adds state/behaviour to components. `useAuth` (current user), `useApi` (load data with loading/error and optional polling), `useToast` (temporary messages).

**9. How do protected routes work?** `ProtectedRoute` checks the user from `AuthContext` and role list; otherwise redirects. The backend checks again, so this is only UX.

**10. How is the UI responsive?** Tailwind breakpoints (`sm:`, `md:`, `lg:`); sidebar becomes a drawer on mobile; tables scroll inside cards.

## C. Backend & security

**11. What is a Blueprint?** A group of related Flask routes (e.g. all `/api/admin` routes) registered on the app in `create_app()`.

**12. How are passwords stored?** As Werkzeug hashes (salted, one-way). Login hashes the typed password and compares.

**13. What is a JWT and why is it safe?** A signed token containing the user id. It can be read but not modified without `JWT_SECRET_KEY`, because the signature would not match.

**14. If the token contains the role, can a user change it to "admin"?** No — the signature would break. Also, `auth_required` ignores the token's role claim and reloads the user's role from the database.

**15. How does logout work with JWTs?** The token's `jti` is stored in `TokenBlocklist`; the blocklist loader rejects it afterwards.

**16. How do you stop a donor editing someone else's donation?** Every donor route compares `donation.donor_id` with the logged-in user's id from the token → 403. The `donor_id` in a request body is ignored (tested).

**17. How are admin endpoints protected?** `@auth_required("admin")` on every route in `admin_routes.py`. Tested with a donor token → 403.

**18. Where are secrets stored?** `backend/.env` (not committed; `.env.example` is the template). `create_app()` refuses to start without them.

**19. What validation happens on the backend?** Required fields, types, ranges, allowed choices, email format, password strength, date parsing, then food-safety rules. Errors return field-level messages.

## D. Database

**20. Name your models and their relationships.** User 1–1 NGOProfile; User 1–N Donation; Donation 1–N CollectionRequest; NGOProfile 1–N CollectionRequest; Donation 1–N DonationStatusHistory; User 1–N Notification; AuditLog, DonationReport, ContactMessage, TokenBlocklist.

**21. Why store quantity and servings separately?** "10 kg" and "40 servings" mean different things; matching uses servings, the donor describes quantity.

**22. How do you prevent two NGOs claiming the same donation?** A conditional atomic `UPDATE donations SET status='ACCEPTED' … WHERE id=? AND status='REQUESTED' AND assigned_ngo_id IS NULL`. Only one call can change the row; the other gets 0 rows → 409. Plus a UNIQUE constraint on (donation, NGO) requests.

**23. What is a transaction? Where do you use it?** A group of changes saved together. Accepting a request updates the donation, the request, other requests, history and notifications — all in one `commit()`.

**24. Why SQLite? Can it scale?** Zero setup for a demo. SQLAlchemy lets us switch to PostgreSQL by changing `DATABASE_URL`.

**25. Why store lists as comma-separated text?** Simplicity for beginners. In production we would normalise into separate tables.

## E. Matching

**26. Explain the formula.** Hard filters first, then `score = location 30 + capacity 20 + category 15 + dietary 15 + deadline 20`.

**27. Work out a score.** (See MATCHING_ALGORITHM.md §5: 15 + 15 + 6 + 7 + 20 = 63.)

**28. Why are some NGOs excluded instead of scored low?** Because those rules are about safety or feasibility (cannot refrigerate, no capacity, too late, unverified). A high score must never override them.

**29. How is location calculated without GPS?** Area names and PIN codes: exact area/PIN = 30; same first three PIN digits (postal district) = 15; otherwise excluded. Clearly labelled "area-based".

**30. Is the algorithm deterministic?** Yes; same inputs give the same output; ties are broken by free capacity then name. Tested.

**31. How do you know the explanation matches the score?** The sentence is built from the same `reason` strings returned by each scoring function that produced the points.

**32. How would you add machine learning?** Collect accepted/rejected request data, train a model, return the same `components`/`score` shape, keep Stage 1 filters.

## F. Food safety & lifecycle

**33. What safety checks are done?** Blocks: expired, use-by before preparation, preparation in the future, deadline passed / under 30 min, deadline after use-by, very old perishable food, no declaration. Warnings: urgent expiry, long holding time, unpackaged cooked food, cold chain, no allergens.

**34. Can the app guarantee food is safe?** No. It checks the information entered. A disclaimer says the donor is responsible and must follow local regulations.

**35. List the statuses and transitions.** AVAILABLE → REQUESTED → ACCEPTED → PICKUP_SCHEDULED → COLLECTED → DELIVERED; alternatives CANCELLED, EXPIRED, REJECTED. Defined in `ALLOWED_TRANSITIONS`.

**36. What happens if an NGO tries to jump from ACCEPTED to DELIVERED?** `change_status` raises 409 INVALID_STATUS_TRANSITION with the allowed next statuses.

**37. How do donations expire without a scheduler?** "Lazy expiry": list and detail endpoints first call `expire_overdue_donations()`, which marks overdue rows EXPIRED and notifies people.

**38. Is tracking real-time?** Near-real-time: pages poll every 15–30 s. It is status tracking, not GPS. WebSockets could be added later.

**39. How are notifications generated?** Only by backend events (`notify_user` in services) inside the same transaction as the change; the frontend just reads them.

## G. Analytics & testing

**40. How is the completion rate calculated?** Delivered ÷ (delivered + cancelled + expired + rejected) × 100; in-progress donations are excluded.

**41. Are the CO₂ numbers real?** No — illustrative estimates (0.4 kg per serving, 2.5 kg CO₂e per kg) and labelled as such. Counts are real database values.

**42. What tests did you write?** 54 pytest tests: matching, food safety, auth, authorization, donation creation/validation, duplicate claims, transitions, expiry, analytics. They use an in-memory database.

**43. What would you improve with more time?** Distance-based matching, opening-hour checks, ML ranking, WebSockets, SMS/email, image uploads, PostgreSQL + migrations, httpOnly cookie auth, deployment.
