# EcoHealth — Full Project Handover Prompt

> **Copy everything below this line and paste it as your first message in a new AI session.**

---

## 1. Project Overview

**EcoHealth** is a gamified wellness platform (university graduation project) that encourages eco-friendly physical activity. Users explore real-world routes (hiking, cycling, running, walking), complete them to earn XP, level up their character, and unlock badges. The platform includes an Admin panel for managing activities, users, categories, and route creation. Users can also rate and review activities.

**Local project path:** `/Users/ates/projects/EcoHealth`

---

## 2. Git & Identity (CRITICAL)

- **GitHub Username:** `yavsanmahmutcan8-source` (Mahmut Can)
- **GitHub Email:** `yavsanmahmutcan8@gmail.com`
- **Repository:** `git@github.com:yavsanmahmutcan8-source/EcoHealth.git`
- **Branch:** `main`
- **SSH Key for GitHub:** `/Users/ates/.ssh/id_ed25519_ecohealth`
- **SSH Config:** Already configured in `~/.ssh/config` — the default `github.com` host uses this key.

Git config is already set locally in the repo:
```
git config user.name = yavsanmahmutcan8-source
git config user.email = yavsanmahmutcan8@gmail.com
```

**Standard git workflow:**
```bash
cd /Users/ates/projects/EcoHealth
git add . && git commit -m "message" && git push origin main
```

---

## 3. Production Server Details

- **Server:** AWS Lightsail Ubuntu — IP: `52.58.30.77`
- **SSH Access:** `ssh -i ~/.ssh/id_ed25519_ecohealth ubuntu@52.58.30.77`
- **Project location on server:** `~/EcoHealth`
- **URL:** `https://52.58.30.77.nip.io` (uses nip.io for SSL)

**Deploy command (from local Mac):**
```bash
# For frontend-only changes (no backend changes):
ssh -i ~/.ssh/id_ed25519_ecohealth -o StrictHostKeyChecking=no ubuntu@52.58.30.77 \
  "cd ~/EcoHealth && git fetch origin && git reset --hard origin/main && sudo docker compose -f docker-compose.prod.yml restart nginx"

# For backend changes (rebuilds the backend container):
ssh -i ~/.ssh/id_ed25519_ecohealth -o StrictHostKeyChecking=no ubuntu@52.58.30.77 \
  "cd ~/EcoHealth && git fetch origin && git reset --hard origin/main && sudo docker compose -f docker-compose.prod.yml up -d --build backend"

# For full stack rebuild (both backend + nginx):
ssh -i ~/.ssh/id_ed25519_ecohealth -o StrictHostKeyChecking=no ubuntu@52.58.30.77 \
  "cd ~/EcoHealth && git fetch origin && git reset --hard origin/main && sudo docker compose -f docker-compose.prod.yml up -d --build backend nginx"
```

**IMPORTANT DEPLOYMENT RULES:**
1. The production Nginx serves the frontend from `frontend/dist/`. After any frontend change: run `npm run build` locally in `frontend/`, then `git add -f frontend/dist`, commit, push, then deploy.
2. For backend Python changes, you MUST use `--build` flag in docker compose, otherwise the old code runs.
3. For new DB models: After deploying, run `sudo docker exec ecohealth_backend_prod alembic revision --autogenerate -m 'description'` followed by `sudo docker exec ecohealth_backend_prod alembic upgrade head` on the server (no `-it` flag via SSH).
4. **White screen / MIME errors** after deploy = the `frontend/dist/` was not committed. Always force-add it.

**Admin accounts on production:**
- `atesztrk` (atesztrk@gmail.com) — admin
- `admin123` (admin123@gmail.com) — admin

To promote any user to admin:
```bash
sudo docker exec ecohealth_backend_prod python promote_admin.py <username>
```

To reset a user's password:
```bash
sudo docker exec ecohealth_backend_prod python reset_password.py <email> <new_password>
```

To list all users:
```bash
sudo docker exec ecohealth_db_prod psql -U ecohealth_admin -d ecohealth_production_db -c 'SELECT id, username, email, is_admin FROM "user";'
```

---

## 4. Tech Stack

### Frontend (`/frontend`)
- React 19 + Vite 8
- Vanilla CSS (CSS Modules per page/component)
- `react-router-dom` v7 for routing
- `zustand` for state management (stores in `src/store/`)
- `react-leaflet` + `leaflet` for maps
- `lucide-react` for icons
- `@react-oauth/google` for Google Sign-In

### Backend (`/backend`)
- Python 3.10 + FastAPI
- SQLAlchemy v2 (async) + Alembic for migrations
- PostgreSQL 15 with PostGIS (via `GeoAlchemy2`)
- Redis 7 for caching
- JWT auth (`PyJWT` + `passlib` bcrypt)
- `pydantic-settings` for config

### Infrastructure
- Docker Compose (`docker-compose.prod.yml`)
- Services: `db` (PostGIS), `redis`, `backend` (FastAPI), `nginx` (serves frontend + reverse proxy)
- Avatar files are stored in `/app/static/avatars/` inside the backend container, persisted via Docker volume `backend_static_prod`.

---

## 5. Source File Structure

### Frontend Key Files
```
frontend/src/
├── App.jsx                              # Routes: /auth, /dashboard, /explore, /profile, /admin, /activity/:id
├── main.jsx                             # Entry point
├── index.css                            # Global CSS + design tokens + dark mode + mobile-first defaults
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx                   # Sticky nav + notification bell dropdown (Zustand-powered)
│   │   ├── FloatingActivityButton.jsx   # Global FAB shown when an activity session is active
│   ├── ui/
│   │   ├── Button.jsx, Card.jsx, Input.jsx, Modal.jsx, Toast.jsx, ThemeToggle.jsx, Skeleton.jsx
│   │   ├── StarRating.jsx               # ⭐ Reusable star rating (interactive + display modes)
│   │   ├── ActivityReviews.jsx          # 💬 Collapsible reviews section (list + submit + sort)
├── features/
│   ├── auth/AuthPage.jsx                # Login/Register + Google OAuth (accepts email OR username for login)
│   ├── dashboard/DashboardPage.jsx      # Stats, XP bar, "Picked For You" carousel, activity preview modal
│   ├── explore/ExplorePage.jsx          # Map + activity cards + preview modal with reviews + category filter
│   ├── activity/ActivitySessionPage.jsx # LIVE session: GPS tracking, route display, timer, completion
│   ├── profile/ProfilePage.jsx          # Badge gallery (locked/unlocked), user info, Edit Profile modal
│   ├── admin/AdminPage.jsx              # Tabs: Users (with Role column) | Activities | Route Builder | Categories
├── store/
│   ├── authStore.js                     # Auth state (login by email OR username, register, fetchUser, token)
│   ├── activitySessionStore.js          # Active session state (GPS, timer, distance, persisted to localStorage)
│   ├── notificationStore.js             # Notification state (fetch, unread count, polling)
│   ├── themeStore.js                    # Dark/light mode
│   ├── toastStore.js                    # Toast notifications
```

### Backend Key Files
```
backend/
├── main.py                          # FastAPI app entry point
├── api/
│   ├── routes.py                    # ALL API endpoints (auth, activities, admin, categories, reviews, badges, notifications)
│   ├── schemas.py                   # Pydantic schemas (UserCreate, ActivityOut, ReviewOut, BadgeDefinitionOut, etc.)
│   ├── deps.py                      # Dependencies (get_current_user, get_current_active_admin)
├── models/
│   ├── user.py                      # User model — username, email, xp, level, badges (JSON), is_admin, display_name, bio, avatar_url, total_distance_km
│   ├── activity.py                  # Activity model — title, category, location (PostGIS), route_polyline, xp_reward, creator_id (FK)
│   ├── category.py                  # Category model — name, emoji, color (admin-managed)
│   ├── review.py                    # Review model — user_id (FK), activity_id (FK), rating 1-5, comment, created_at
│   ├── badge_definition.py          # BadgeDefinition — id (str PK), name, description, emoji, color, condition_type, condition_config (JSON)
│   ├── completion_log.py            # CompletionLog — user_id, activity_id, category snapshot, completed_at (timestamp)
│   ├── notification.py              # Notification — user_id, type (enum), title, message, is_read, created_at
├── services/
│   ├── gamification.py              # XP/level calculation on activity completion; triggers badge evaluator
│   ├── recommendation.py            # Match score algorithm (fitness capacity vs. activity difficulty, BMI/age/level)
│   ├── badge_evaluator.py           # Stateless evaluate_badges() called after every completion/review
│   ├── geofence.py                  # Geofencing utilities (not actively used in UI yet)
├── core/
│   ├── config.py                    # Settings from .env (DATABASE_URL, SECRET_KEY, REDIS_URL, etc.)
│   ├── security.py                  # JWT token creation/verification, bcrypt password hashing
│   ├── cache.py                     # Redis connection helper
├── db/
│   ├── session.py                   # Async SQLAlchemy session factory
│   ├── base.py                      # Imports ALL models so SQLAlchemy registry is complete (CRITICAL — prevents mapper errors)
│   ├── base_class.py                # DeclarativeBase with __tablename__ auto-set from class name
├── alembic/versions/                # Database migration files
├── promote_admin.py                 # Promote a user to admin by username
├── list_users.py                    # List all users from the DB
├── reset_password.py                # Reset a user's password by email
```

### Key API Endpoints
```
POST /api/auth/register              — Register new user (username, email, password)
POST /api/auth/login                 — Login (accepts email OR username in the username field; returns JWT)
POST /api/auth/google                — Google OAuth login (sends Google access_token)
GET  /api/users/me                   — Current user profile
PUT  /api/users/me/profile           — Update profile (display_name, bio, username)
POST /api/users/me/avatar            — Upload profile photo (multipart JPEG/PNG, max 2MB)
GET  /api/users/me/badge-progress    — Badge progress for count-based badges

GET  /api/activities                 — List activities (?lat=&lng=&radius_km= for geo-filter)
POST /api/activities/{id}/complete   — Complete an activity (awards XP, checks badges, logs completion)
GET  /api/activities/{id}/reviews    — Get reviews (?sort=rating|date&order=asc|desc)
POST /api/activities/{id}/reviews    — Submit a review (rating 1-5 + comment; triggers FIRST_REVIEW badge)
GET  /api/activities/{id}/rating     — Aggregate average_rating + review_count
DELETE /api/reviews/{id}             — Delete review (author or admin)

GET  /api/categories                 — List all categories (public)
POST /api/admin/categories           — Create category (admin)
PUT  /api/admin/categories/{id}      — Update category (admin)
DELETE /api/admin/categories/{id}    — Delete category (admin)

GET  /api/badges                     — List all badge definitions (public)
POST /api/admin/badges               — Create badge definition (admin)
PUT  /api/admin/badges/{id}          — Update badge definition (admin)
DELETE /api/admin/badges/{id}        — Delete badge definition (admin)

GET  /api/notifications              — User's notifications (newest first)
PUT  /api/notifications/{id}/read    — Mark one notification as read
PUT  /api/notifications/read-all     — Mark all notifications as read

GET  /api/dashboard/recommendations  — Personalized "Picked For You" list (cached in Redis 10 min)
GET  /api/admin/users                — List all users (admin only; includes is_admin flag)
PUT  /api/admin/users/{id}           — Update user XP/level/badges (admin only)
POST /api/admin/activities           — Create activity (admin only)
PUT  /api/admin/activities/{id}      — Update activity (admin only)
DELETE /api/admin/activities/{id}    — Delete activity (admin only)
```

---

## 6. What Has Been Completed (All ✅)

### Backend — Phases 1–9 ALL DONE
- Infrastructure, Docker, PostgreSQL with PostGIS, Redis, Alembic migrations
- JWT auth with password hashing + Google OAuth
- Gamification engine (XP, levels, badges earned at exact moment condition is satisfied)
- Match Score recommendation engine (BMI + age + user level → fitness capacity → activity difficulty match)
- PostGIS geospatial queries (radius search by lat/lng)
- Admin CRUD (activities with route polylines, users, categories, badges)
- Activity completion endpoint (XP award + badge evaluation + completion log + notifications)
- Redis caching for dashboard recommendations (10-minute TTL per user)
- Category model + CRUD API (14 categories seeded including Hiking, Cycling, Yoga, Kayaking, etc.)
- Review/Rating model + CRUD API with sorting
- BadgeDefinition model + 17 badges seeded across all condition types
- CompletionLog model (activity history powering all badge checks)
- Smart Badge Evaluator service (`evaluate_badges()`) — 10 condition types
- Notification model + endpoints (`BADGE_EARNED`, `LEVEL_UP` auto-triggered)
- User profile customization: `display_name`, `bio`, `avatar_url`, `total_distance_km`
- Avatar upload API — stored in `/app/static/avatars/`, served by Nginx at `/static/avatars/`
- **Login accepts email OR username** (fixed via `OR` query in auth endpoint)
- `reset_password.py`, `promote_admin.py`, `list_users.py` utility scripts in `/backend/`

### Frontend — Phases 1–9 ALL DONE
- Full React app with auth, dashboard, explore, profile, admin pages
- Dark mode, glassmorphism design, responsive mobile-first CSS
- Interactive map (Leaflet) on Explore and Admin pages
- Admin Route Builder (click-to-draw paths on map)
- Admin Categories tab (create/edit/delete categories with emoji + color)
- Live Activity Session page with GPS tracking, route visualization, timer, distance
- Floating "Active Activity" button visible on all pages during a session
- Confetti celebration animation on activity completion
- Activity preview modals with route map on both Dashboard and Explore pages
- Localized user discovery (auto-geolocation + map pan reloads nearby activities)
- Comprehensive mobile optimization (bottom sheet modals, compact nav, touch-friendly)
- Dynamic category dropdowns — API-driven, never hardcoded
- StarRating component — interactive 1-5 stars with gold fill animation
- Activity Reviews section — collapsible in preview modals with submit form, sorting, delete
- Badge Gallery on Profile — locked (greyscale + 🔒) and unlocked (full color + glow) states
- Badge progress bars for count-based badges ("2/5 completed")
- Achievement toast notifications with badge emoji + confetti on unlock
- Edit Profile modal — avatar upload, display name, username, bio (160 char limit)
- Notification bell in Navbar — unread count badge, dropdown panel, "Mark all read"
- **Admin user table has a "Role" column** — green "Admin" badge or grey "User" badge
- **Login form accepts email or username** (frontend sends to `/api/auth/login`)
- Removed test-user hint from login form

---

## 7. What Needs To Be Done Next

The next phases are fully planned in `TECHNICAL_ROADMAP.md` (Phases 10–14). Here is the priority order and summary:

### Phase 10 — Fitness Profile & Onboarding Data Collection
**Why:** The recommendation engine has BMI/age/height/weight fields in the DB but they are never populated (signup form doesn't ask for them). The engine therefore uses default values for everyone.

**Backend tasks:**
- Add `fitness_level` column (enum: beginner/intermediate/advanced/athlete) to `User` model + migration
- Extend `ProfileUpdate` schema to accept `age`, `sex`, `weight_kg`, `height_cm`, `fitness_level`
- Extend `UserOut` to return these fields

**Frontend tasks:**
- Multi-step signup: after creating account, show Step 2 "About You" (age, sex, weight, height, fitness level — all skippable)
- Add "Health & Fitness" collapsible section to the Edit Profile modal with the same fields
- Track `onboarding_complete` boolean on User to know if onboarding was shown

### Phase 11 — Favorite Activities & Interest-Based Personalization
**Why:** Users have no way to express preferences. Recommendations treat all categories equally.

**Backend tasks:**
- Add `favorite_categories` (JSON list) + `onboarding_complete` (bool) columns to `User` + migration
- New endpoint: `PUT /api/users/me/interests` — saves favorite categories, sets `onboarding_complete = True`

**Frontend tasks:**
- Signup Step 3: Category picker grid ("What activities excite you?") — fetched from `/api/categories`, minimum 1 required, skippable
- Add "My Interests" toggleable category grid to Edit Profile modal
- Google OAuth users who haven't completed onboarding see the same flow on first login

### Phase 12 — User-Created Activities & Creator Attribution
**Why:** Currently only admins can create activities. Users should be able to contribute routes, and creators should be rewarded.

**Backend tasks:**
- New endpoint `POST /api/activities` (authenticated, any user) — auto-publishes, sets `creator_id`
- Add `creator_username` + `creator_avatar_url` to `ActivityOut` schema (via JOIN)
- Creator earns bonus XP (10% of xp_reward) when others complete their activities
- New badge conditions: `ACTIVITIES_CREATED`, `CREATOR_COMPLETIONS`
- Seed 3 new creator badges: `route_maker`, `trail_architect`, `community_builder`
- Add `creator_completions_count` to `User` model + migration

**Frontend tasks:**
- Extract Route Builder into a shared `CreateActivityPage.jsx` accessible to all users (not just admin)
- Add "Create Activity" button/link in Navbar or Dashboard
- Show "Created by @username" label on activity cards; "Official Route 🏛️" for admin-created

### Phase 13 — Public User Profiles & Social Search
**Why:** Users can't view each other's profiles. There's no social layer. Usernames are not clickable.

**Backend tasks:**
- `GET /api/users/{username}` — public-safe profile (no email/weight/height/admin status)
- `GET /api/users/{username}/activities` — completed activity history
- `GET /api/users/{username}/created-activities` — activities created by this user
- `GET /api/users/{username}/reviews` — reviews written by this user
- `GET /api/users/search?q=` — case-insensitive ILIKE search on username + display_name

**Frontend tasks:**
- New route `/profile/:username` — read-only public profile with tabs (Activities, Created Routes, Badges, Reviews)
- Upgrade own `/profile` to same tabbed layout (keeps Edit Profile + Log Out)
- Clickable @usernames in review cards, activity creator labels, admin user table
- Search bar in Navbar (debounced, dropdown results with avatar + username + level)

### Phase 14 — Recommendation Engine v2
**Why:** Once fitness data (Phase 10) and interests (Phase 11) are collected, the engine can give much smarter recommendations.

**Backend tasks (in `services/recommendation.py`):**
- +15% score boost if activity category is in `user.favorite_categories`
- Use `fitness_level` as direct capacity base (beginner=1.5, intermediate=2.5, advanced=3.5, athlete=4.5)
- -30% penalty for activities the user has already completed (from CompletionLog)
- Invalidate Redis cache when user updates profile or interests

**Frontend tasks:**
- "Why this match?" info tooltip on "Picked For You" cards
- Quick-filter chips by favorite categories below the carousel

---

## 8. Important Patterns & Gotchas

1. **Frontend dist must be committed:** `frontend/dist/` is served by Nginx directly. Always `npm run build` + `git add -f frontend/dist` before pushing. A white screen with MIME type errors = stale or missing dist.

2. **Backend rebuilds require `--build`:** For any Python code change, use `docker compose up -d --build backend`. Without it, Docker uses the cached image and your changes don't run.

3. **Alembic migrations on server:** After adding new models or columns:
   ```bash
   sudo docker exec ecohealth_backend_prod alembic revision --autogenerate -m 'description'
   sudo docker exec ecohealth_backend_prod alembic upgrade head
   ```
   Do NOT use `-it` flag when running via SSH — it will fail with "the input device is not a TTY".

4. **`db/base.py` MUST import all models:** SQLAlchemy requires all models to be registered before any query runs. If you add a new model, import it in `backend/db/base.py`. Failing to do this causes `InvalidRequestError: When initializing mapper... expression 'ModelName' failed to locate a name` at startup — which crashes the entire API.

5. **Utility scripts must import from `db.base`:** Scripts like `promote_admin.py`, `list_users.py`, `reset_password.py` must import `from db.base import User, Activity, ...` (not `from models.user import User` directly) so the full SQLAlchemy registry is loaded before any query.

6. **Activity.location uses PostGIS:** The `location` column is `Geography('POINT', srid=4326)`. Set it via WKT string: `f"SRID=4326;POINT({longitude} {latitude})"`. Read lat/lng via `@property` methods on the `Activity` model (`activity.latitude`, `activity.longitude`).

7. **Route polyline is JSON in a Text column:** `route_polyline` stores `JSON.stringify([[lat, lng], ...])`. Parse with `JSON.parse()` on the frontend. Do not try to use it as a JSON column in the DB.

8. **Auth flow:** Login returns `{access_token, token_type}`. All authenticated requests send `Authorization: Bearer <token>`. The login endpoint accepts **either email or username** in the `username` field (uses an `OR` SQLAlchemy query).

9. **Admin check:** `is_admin` boolean on `User` model. `get_current_active_admin` dependency in `api/deps.py` guards admin-only routes. To promote a user: `python promote_admin.py <username>` inside the backend container.

10. **Categories are dynamic — never hardcode:** All category names/emojis come from `GET /api/categories`. The `Category` table is seeded with 14 categories.

11. **Reviews constraint:** Each user can review an activity only once (unique DB constraint on `(user_id, activity_id)`). Reviews are fetched via JOIN to get the reviewer's username.

12. **Avatar persistence:** Avatar files live in `/app/static/avatars/` inside the backend container, backed by the `backend_static_prod` Docker volume. They are served by Nginx at `/static/avatars/{filename}`. Without the volume mount in `docker-compose.prod.yml`, avatars are lost on container restart.

13. **Redis cache invalidation:** The dashboard recommendations are cached per-user with key `recommendations:{user_id}` for 10 minutes. When fitness data or interests are updated (Phases 10–11), explicitly delete this key so the next load recalculates.

14. **Notification polling:** The frontend polls `/api/notifications` every 30 seconds via `notificationStore.js` to update the unread count badge on the bell icon.

---

## 9. Known Issues & Decisions Made

- `testadmin99` / `admin99@example.com` account exists in the DB but login was broken (password mismatch). Use `reset_password.py` to fix if needed.
- Google OAuth creates users without a real password. Their `hashed_password` is set to `get_password_hash("google_sso_managed_password_" + email)`. They cannot log in with email/password — only with Google.
- The `Activity.category` field is still a plain string (not a FK to Category). This was intentional to avoid a complex migration. When using categories, the string must match a `Category.name` exactly.
- `visibility_state` on Activity supports `"publish"` and `"draft"`. Only published activities appear in the standard `/api/activities` list.
- The bulk publish/draft buttons in the Admin UI show a "not yet implemented" toast — this is a known placeholder.

---

**Next session: Start with Phase 10 (Fitness Profile). Begin with the backend tasks (add `fitness_level` to User model, update `ProfileUpdate` schema, run migration), then build the multi-step signup flow in the frontend. Follow the order in `TECHNICAL_ROADMAP.md` Phases 10 → 11 → 12 → 13 → 14.**
