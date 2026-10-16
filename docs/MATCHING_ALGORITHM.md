# FoodConnect – The Explainable Matching Algorithm

File: `backend/app/services/matching.py` · Tests: `backend/tests/test_matching.py`

## 1. The question it answers

> "For this donation, which verified NGOs should the donor contact first, and why?"

The same algorithm also runs in reverse for NGOs ("which open donations suit *us* best?").

## 2. Why weighted scoring and not a "real" AI model?

- **Explainable:** every point has a reason a donor can read and a teacher can verify by hand.
- **Deterministic:** same inputs → same output (tested). No randomness.
- **No data needed:** a machine-learning model needs thousands of past donations to learn from; a new platform has none.
- **Free and offline:** no API keys, no cloud service.
- **Upgradeable:** `calculate_match_score()` returns a fixed dictionary shape. A future ML model could return the same shape and the rest of the app would not change.

It is "intelligent" in the sense of automated, multi-criteria decision-making; we describe it honestly as rule-based scoring.

## 3. Stage 1 – hard filters (`find_exclusion_reasons`)

An NGO is **excluded** (not just scored low) if any rule fails. These are safety/feasibility rules, so a score must never override them.

| Code | Rule |
|---|---|
| `NOT_VERIFIED` | `verification_status != "verified"` |
| `SUSPENDED` | NGO user account is suspended |
| `DIETARY` | vegetarian-only NGO + non-veg food, or vegan-only NGO + non-vegan food |
| `STORAGE` | refrigerated food but NGO cannot refrigerate; frozen food but NGO cannot freeze |
| `PACKAGING` | unpackaged food but NGO only accepts packaged |
| `CAPACITY` | remaining capacity < servings |
| `DEADLINE` | `now + pickup_lead_time_minutes > pickup_deadline` |
| `LOCATION` | pickup area/PIN not served and not even the same postal district |

**Remaining capacity** (`get_available_capacity`) = `max_capacity_servings` − servings of donations already assigned to the NGO with status ACCEPTED, PICKUP_SCHEDULED or COLLECTED.

## 4. Stage 2 – the score (`calculate_match_score`)

```
score = location (0–30) + capacity (0–20) + category (0–15) + dietary (0–15) + deadline (0–20)
```

| Function | Points | Rule |
|---|---|---|
| `score_location` | 30 | pickup **area** (case/space-insensitive) is in NGO service areas, **or** pickup PIN is in NGO PINs |
| | 15 | same first **3** PIN digits (same postal sorting district, e.g. all Chennai codes start `600`) |
| | 0 | otherwise (→ excluded) |
| `score_capacity` | 20 | free capacity ≥ 2 × servings |
| | 15 | ≥ 1.25 × servings |
| | 10 | ≥ servings (just enough) |
| | 0 | less than servings (→ excluded) |
| `score_category` | 15 | NGO has no preference (accepts all) **or** category is preferred |
| | 6 | accepted but not preferred |
| `score_dietary` | 15 | NGO accepts any / requirement satisfied / prefers-veg + veg food |
| | 7 | NGO *prefers* vegetarian but food is non-veg |
| | 0 | requirement violated (→ excluded) |
| `score_deadline` | 20 | spare time after travel ≥ 3 h |
| | 14 | ≥ 1 h |
| | 8 | ≥ 0 h |
| | 0 | cannot arrive in time (→ excluded) |

**Why these weights?** Location (30) matters most because food must travel quickly and NGOs serve specific communities. Deadline (20) and capacity (20) decide whether collection is *feasible*. Category (15) and diet (15) decide whether the food is *useful* to the NGO's beneficiaries. They add up to 100 so the score reads like a percentage.

**Ranking (`rank_ngos_for_donation`):** sort by score (high → low), then free capacity (high → low), then name (A → Z). The last two make the order deterministic when scores tie.

**Explanation text:** the five component reasons are joined into one sentence: *"Recommended because the NGO serves the pickup area (Adyar), has plenty of spare capacity (250 servings free for 30 needed), prefers cooked meals, accepts vegetarian food, and can collect comfortably before the deadline (4.2 h to spare)."* Because the sentence is built from the same values that produced the points, **the explanation always matches the score**.

## 5. Worked numerical example 1 (mixed scores) – verified by a unit test

Donation: non-vegetarian cooked meal, 40 servings, unpackaged, room temperature, area **Adyar**, PIN **600020**, deadline in **5 h**.
NGO: verified, serves **Guindy / 600032**, **60** servings free, prefers **bakery**, **prefers vegetarian**, **30 min** travel, accepts unpackaged.

| Step | Working | Points |
|---|---|---|
| Hard filters | verified ✔, diet rule only a *preference* ✔, room temp ✔, unpackaged accepted ✔, 60 ≥ 40 ✔, 0.5 h < 5 h ✔, PIN 600… same district ✔ | eligible |
| Location | "adyar" ∉ ["guindy"], 600020 ∉ [600032], `600 == 600` | 15 |
| Capacity | 60 / 40 = 1.5 → ≥ 1.25 | 15 |
| Category | "cooked_meals" ∉ ["bakery"] | 6 |
| Dietary | prefers vegetarian, food non-veg | 7 |
| Deadline | 5 h − 0.5 h = 4.5 h ≥ 3 h | 20 |
| **Total** | | **63** |

Test: `test_score_equals_sum_of_components` asserts `15 + 15 + 6 + 7 + 20`.

## 6. Worked example 2 (seeded demo data – "Idli, vada and coconut chutney")

Donation: vegetarian cooked meal, 30 servings, unpackaged, room temperature, Adyar 600020, deadline in ~4.5 h.

| NGO | Location | Capacity | Category | Diet | Deadline | Total / status |
|---|---|---|---|---|---|---|
| Helping Hands (Adyar, 250 free, prefers cooked, any diet, 45 min) | 30 | 20 (250/30 ≥ 2) | 15 | 15 | 20 | **100** – rank 1 |
| Anna Nagar Community Kitchen (600040, 176 free, accepts all, prefers veg, 60 min) | 15 | 20 | 15 | 15 | 20 | **85** |
| Annadhanam Trust (T. Nagar 600017, 105 free, cooked, veg-only, 60 min) | 15 | 20 | 15 | 15 | 20 | **85** (ranked after Anna Nagar: less free capacity) |
| Green Plate Shelter | – | – | – | – | – | **Excluded**: does not accept unpackaged food |
| Little Lights Children's Home | – | – | – | – | – | **Excluded**: not verified (hidden from donors) |

(Exact deadline points depend on when you seeded the data.)

## 7. How it is tested

`tests/test_matching.py` (13 tests): weights sum to 100 · perfect match = 100 with explanation · total = sum of components · every level of location, capacity and deadline scoring · unverified excluded · diet exclusion · storage and packaging exclusions · capacity exclusion · deadline exclusion · ranking order and identical output on repeat runs · tie-breaking. Tests pass a fixed `now`, so they never depend on the real clock.

## 8. How to extend it

- **Distance:** geocode addresses (e.g. OpenStreetMap Nominatim) and replace `score_location` with a distance-based score.
- **Opening hours:** reduce the deadline score if the NGO is closed during the pickup window.
- **Learning:** log which recommendations donors pick and NGOs accept, then train a model that outputs the same `components`/`score` structure, keeping Stage 1 hard filters unchanged.
