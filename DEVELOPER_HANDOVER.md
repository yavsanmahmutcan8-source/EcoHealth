# EcoHealth — Full Project Handover Prompt

> **Copy everything below this line and paste it as your first message in a new AI session.**

---

## 1. Project Overview

**EcoHealth** is a gamified wellness platform (university graduation project) that encourages eco-friendly physical activity. Users explore real-world routes (hiking, cycling, running, walking), complete them to earn XP, level up their character, and unlock badges. The platform includes an Admin panel for managing activities, users, and route creation.

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
  "cd ~/EcoHealth && git fetch origin && git reset --hard origin/main && sudo docker compose -f docker-compose.prod.yml up -d --build"
```

**IMPORTANT DEPLOYMENT RULE:** The production Nginx serves the frontend from `frontend/dist/`. After any frontend change:
1. Run `npm run build` locally in `frontend/`
2. `git add -f frontend/dist` (dist is force-added since it's in .gitignore by default)
3. Commit and push
4. Then deploy on the server

**Admin account:** Username `atesztrk` is promoted to admin. To promote other users, run inside the backend container:
```bash
sudo docker exec -it ecohealth_backend_prod python promote_admin.py <username>
```

---

## 4. Tech Stack

### Frontend (`/frontend`)
- React 19 + Vite 8
- Vanilla CSS (CSS Modules)
- `react-router-dom` v7 for routing
- `zustand` for state management (stores in `src/store/`)
- `react-leaflet` + `leaflet` for maps
- `lucide-react` for icons

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

---

## 5. Source File Structure

### Frontend Key Files
```
frontend/src/
├── App.jsx                            # Routes: /auth, /dashboard, /explore, /profile, /admin, /activity
├── main.jsx                           # Entry point
├── index.css                          # Global CSS + design tokens + dark mode
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx                 # Sticky nav with links (Dashboard, Explore, Admin)
│   │   ├── FloatingActivityButton.jsx # Global FAB shown when an activity session is active
│   ├── ui/
│   │   ├── Button.jsx, Card.jsx, Input.jsx, Modal.jsx, Toast.jsx, ThemeToggle.jsx, Skeleton.jsx
├── features/
│   ├── auth/AuthPage.jsx              # Login/Register + Google OAuth
│   ├── dashboard/DashboardPage.jsx    # Stats, XP bar, "Picked For You" carousel with View & Start
│   ├── explore/ExplorePage.jsx        # Map + activity cards with preview modal + Start Activity
│   ├── explore/ActiveSessionModal.jsx # (Legacy — replaced by ActivitySessionPage)
│   ├── activity/ActivitySessionPage.jsx # LIVE session: GPS tracking, route display, timer, completion celebration
│   ├── profile/ProfilePage.jsx        # Badge gallery, user info
│   ├── admin/AdminPage.jsx            # Tabs: Users | Activities Table | Route Builder (map click-to-draw)
├── store/
│   ├── authStore.js                   # Auth state (login, register, fetchUser, token)
│   ├── activitySessionStore.js        # Active session state (GPS, timer, distance, persisted)
│   ├── themeStore.js                  # Dark/light mode
│   ├── toastStore.js                  # Toast notifications
```

### Backend Key Files
```
backend/
├── main.py                        # FastAPI app entry
├── api/
│   ├── routes.py                  # ALL API endpoints (auth, activities, admin, completion)
│   ├── schemas.py                 # Pydantic schemas (UserCreate, ActivityCreate, ActivityOut, etc.)
│   ├── deps.py                    # Dependencies (get_current_user, get_current_active_admin)
├── models/
│   ├── user.py                    # User model (username, email, xp, level, badges, is_admin, etc.)
│   ├── activity.py                # Activity model (title, category, location[PostGIS], route_polyline, xp_reward, etc.)
├── services/
│   ├── gamification.py            # XP/level/badge calculation on activity completion
│   ├── recommendation.py          # Match score algorithm (fitness capacity vs activity difficulty)
│   ├── geofence.py                # Geofencing utilities
├── core/
│   ├── config.py                  # Settings from env vars
│   ├── security.py                # JWT token creation/verification, password hashing
│   ├── cache.py                   # Redis connection
├── db/
│   ├── session.py                 # Async SQLAlchemy session
│   ├── base.py, base_class.py     # SQLAlchemy base
├── promote_admin.py               # Utility: promote a user to admin
├── list_users.py                  # Utility: list all users
```

### Key API Endpoints
```
POST /api/auth/register        — Register new user
POST /api/auth/login            — Login (returns JWT)
POST /api/auth/google           — Google OAuth login
GET  /api/users/me              — Current user profile
GET  /api/activities            — List activities (?lat=&lng=&radius_km= for geo-filter)
POST /api/activities/{id}/complete — Complete an activity (triggers gamification)
GET  /api/dashboard/recommendations — Personalized "Picked For You" with match scores
GET  /api/admin/users           — List all users (admin only)
PUT  /api/admin/users/{id}      — Update user XP/level/badges (admin only)
POST /api/admin/activities      — Create activity with route polyline (admin only)
PUT  /api/admin/activities/{id} — Update activity (admin only)
DELETE /api/admin/activities/{id} — Delete activity (admin only)
```

---

## 6. What Has Been Completed (All ✅)

### Backend (Can) — Phases 1–6 DONE
- Infrastructure, Docker, PostgreSQL, Redis, Alembic migrations
- JWT auth with password hashing + Google OAuth
- Gamification engine (XP, levels, badges)
- Match Score recommendation engine
- PostGIS geospatial queries (radius search)
- Admin CRUD (activities with route polylines, users)
- Activity completion endpoint
- Redis caching for dashboard recommendations

### Frontend (Melikşah) — Phases 1–5 DONE
- Full React app with auth, dashboard, explore, profile, admin pages
- Dark mode, glassmorphism design, responsive mobile-first CSS
- Interactive map (Leaflet) on Explore and Admin pages
- Admin Route Builder (click-to-draw paths on map)
- Live Activity Session page with GPS tracking, route visualization, timer, distance
- Floating "Active Activity" button visible on all pages during a session
- Confetti celebration animation on activity completion
- Activity preview modals with route map on both Dashboard and Explore pages
- Localized user discovery (auto-geolocation + map pan reloads nearby activities)
- Comprehensive mobile optimization (bottom sheet modals, compact nav, touch-friendly buttons)

---

## 7. What Needs To Be Done Next

The next tasks are in `TECHNICAL_ROADMAP.md` — **Phase 7 (Backend)** and **Phase 6 (Frontend)**:

### Backend — Phase 7: Dynamic Categories & Ratings/Comments Engine
- [ ] Create `Category` model (`id`, `name`, `emoji`, `color`) + migration. Update `Activity.category` to FK.
- [ ] Admin Category CRUD endpoints (`POST/GET/PUT/DELETE /api/admin/categories`). Seed initial categories.
- [ ] Create `Review` model (`user_id`, `activity_id`, `rating` 1-5, `comment`, `created_at`). Unique constraint per user per activity.
- [ ] Review API: `POST /api/activities/{id}/reviews`, `GET` with `?sort=rating|date&order=asc|desc`, `DELETE`.
- [ ] Add `average_rating` + `review_count` to `ActivityOut` schema.

### Frontend — Phase 6: Dynamic Categories UI & Ratings/Comments
- [ ] Admin Category Manager tab (create/edit/delete categories with emoji).
- [ ] Replace hardcoded category dropdowns and emoji mappings with API-driven categories.
- [ ] Build reusable `<StarRating>` component (interactive 1-5 stars).
- [ ] Activity Comments/Reviews section in preview modals.
- [ ] Comment submission form with star rating.
- [ ] Comment sorting UI (by rating, by date).

---

## 8. Important Patterns & Gotchas

1. **Frontend dist must be committed:** `frontend/dist/` is served by Nginx directly. Always `npm run build` + `git add -f frontend/dist` before pushing.
2. **Backend rebuilds:** For backend Python changes, you MUST use `--build` flag in docker compose, otherwise the old code runs.
3. **Alembic migrations on server:** After adding new models, run migration inside the container: `sudo docker exec -it ecohealth_backend_prod alembic upgrade head`
4. **Activity.location uses PostGIS:** The `location` column is `Geography('POINT', srid=4326)`. Set it via WKT: `f"SRID=4326;POINT({longitude} {latitude})"`. Access lat/lng via `@property` methods on the model.
5. **Route polyline is stored as JSON string:** `route_polyline` is a `Text` column containing `JSON.stringify([[lat, lng], [lat, lng], ...])`. Parse it with `JSON.parse()` on the frontend.
6. **Auth flow:** Login returns `{access_token, token_type}`. All authenticated requests send `Authorization: Bearer <token>` header.
7. **Admin check:** `is_admin` boolean on User model. `get_current_active_admin` dependency in `api/deps.py` guards admin routes.

---

**Please continue building from the unchecked tasks in `TECHNICAL_ROADMAP.md`. Start with the backend Phase 7 tasks, then the frontend Phase 6 tasks. After each change, build, commit, push, and deploy.**
