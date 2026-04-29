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
  "cd ~/EcoHealth && git fetch origin && git reset --hard origin/main && sudo docker compose -f docker-compose.prod.yml up -d --build"
```

**IMPORTANT DEPLOYMENT RULES:**
1. The production Nginx serves the frontend from `frontend/dist/`. After any frontend change: run `npm run build` locally in `frontend/`, then `git add -f frontend/dist`, commit, push, then deploy.
2. For backend Python changes, you MUST use `--build` flag in docker compose, otherwise the old code runs.
3. For new DB models: After deploying, run `sudo docker exec ecohealth_backend_prod alembic revision --autogenerate -m 'description'` followed by `sudo docker exec ecohealth_backend_prod alembic upgrade head` on the server (no `-it` flag via SSH).

**Admin account:** Username `atesztrk` is promoted to admin. To promote other users:
```bash
sudo docker exec ecohealth_backend_prod python promote_admin.py <username>
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
├── index.css                          # Global CSS + design tokens + dark mode + mobile defaults
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx                 # Sticky nav with links (Dashboard, Explore, Admin)
│   │   ├── FloatingActivityButton.jsx # Global FAB shown when an activity session is active
│   ├── ui/
│   │   ├── Button.jsx, Card.jsx, Input.jsx, Modal.jsx, Toast.jsx, ThemeToggle.jsx, Skeleton.jsx
│   │   ├── StarRating.jsx             # ⭐ Reusable star rating (interactive + display modes)
│   │   ├── ActivityReviews.jsx        # 💬 Collapsible reviews section (list + submit + sort)
├── features/
│   ├── auth/AuthPage.jsx              # Login/Register + Google OAuth
│   ├── dashboard/DashboardPage.jsx    # Stats, XP bar, "Picked For You" carousel, activity preview modal with reviews
│   ├── explore/ExplorePage.jsx        # Map + activity cards + preview modal with reviews + dynamic category filter
│   ├── activity/ActivitySessionPage.jsx # LIVE session: GPS tracking, route display, timer, completion celebration
│   ├── profile/ProfilePage.jsx        # Badge gallery, user info
│   ├── admin/AdminPage.jsx            # Tabs: Users | Activities | Route Builder | Categories (CRUD)
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
│   ├── routes.py                  # ALL API endpoints (auth, activities, admin, categories, reviews)
│   ├── schemas.py                 # Pydantic schemas (User, Activity, Category, Review DTOs)
│   ├── deps.py                    # Dependencies (get_current_user, get_current_active_admin)
├── models/
│   ├── user.py                    # User model (username, email, xp, level, badges, is_admin)
│   ├── activity.py                # Activity model (title, category, location[PostGIS], route_polyline, xp_reward)
│   ├── category.py                # Category model (name, emoji, color) — dynamic admin-managed categories
│   ├── review.py                  # Review model (user_id, activity_id, rating 1-5, comment, created_at)
├── services/
│   ├── gamification.py            # XP/level/badge calculation on activity completion
│   ├── recommendation.py          # Match score algorithm (fitness capacity vs activity difficulty)
│   ├── geofence.py                # Geofencing utilities
├── core/
│   ├── config.py, security.py, cache.py
├── db/
│   ├── session.py, base.py, base_class.py
├── promote_admin.py, list_users.py
```

### Key API Endpoints
```
POST /api/auth/register             — Register new user
POST /api/auth/login                — Login (returns JWT)
POST /api/auth/google               — Google OAuth login
GET  /api/users/me                  — Current user profile

GET  /api/activities                — List activities (?lat=&lng=&radius_km=)
POST /api/activities/{id}/complete  — Complete an activity (triggers gamification)
GET  /api/activities/{id}/reviews   — Get reviews (?sort=rating|date&order=asc|desc)
POST /api/activities/{id}/reviews   — Submit a review (rating 1-5 + comment)
GET  /api/activities/{id}/rating    — Get aggregate average_rating + review_count
DELETE /api/reviews/{id}            — Delete a review (author or admin)

GET  /api/categories                — List all categories (public)
POST /api/admin/categories          — Create category (admin)
PUT  /api/admin/categories/{id}     — Update category (admin)
DELETE /api/admin/categories/{id}   — Delete category (admin)

GET  /api/dashboard/recommendations — Personalized "Picked For You" with match scores
GET  /api/admin/users               — List all users (admin)
PUT  /api/admin/users/{id}          — Update user XP/level/badges (admin)
POST /api/admin/activities          — Create activity with route polyline (admin)
PUT  /api/admin/activities/{id}     — Update activity (admin)
DELETE /api/admin/activities/{id}   — Delete activity (admin)
```

---

## 6. What Has Been Completed (All ✅)

### Backend (Can) — Phases 1–7 ALL DONE
- Infrastructure, Docker, PostgreSQL with PostGIS, Redis, Alembic migrations
- JWT auth with password hashing + Google OAuth
- Gamification engine (XP, levels, badges)
- Match Score recommendation engine
- PostGIS geospatial queries (radius search)
- Admin CRUD (activities, users, categories)
- Activity completion endpoint
- Redis caching for dashboard recommendations
- **Category model + CRUD API** (Phase 7)
- **Review/Rating model + CRUD API with sorting** (Phase 7)

### Frontend (Melikşah) — Phases 1–6 ALL DONE
- Full React app with auth, dashboard, explore, profile, admin pages
- Dark mode, glassmorphism design, responsive mobile-first CSS
- Interactive map (Leaflet) on Explore and Admin pages
- Admin Route Builder (click-to-draw paths on map)
- **Admin Categories tab** (create/edit/delete categories with emoji + color)
- Live Activity Session page with GPS tracking, route visualization, timer, distance
- Floating "Active Activity" button visible on all pages during a session
- Confetti celebration animation on activity completion
- Activity preview modals with route map on both Dashboard and Explore pages
- Localized user discovery (auto-geolocation + map pan reloads nearby activities)
- Comprehensive mobile optimization (bottom sheet modals, compact nav, touch-friendly buttons)
- **Dynamic category dropdowns** — all hardcoded category selects replaced with API-driven categories (Phase 6)
- **StarRating component** — interactive 1-5 stars with gold fill animation (Phase 6)
- **Activity Reviews section** — collapsible reviews in preview modals with submit form, sorting, and delete (Phase 6)

---

## 7. What Needs To Be Done Next

All planned tasks from the TECHNICAL_ROADMAP.md have been completed. Potential next features to consider:

- **Leaderboard** — Public ranking of users by XP, level, or completed activities
- **Social features** — Follow other users, share completed activities
- **Offline mode** — Cache active session data locally so mobile users can complete routes without constant network
- **Activity photos** — Allow users to upload photos from their hikes/runs
- **Push notifications** — Notify users of nearby activities or when they level up
- **Advanced analytics** — Admin dashboard charts for user engagement, popular routes, etc.

---

## 8. Important Patterns & Gotchas

1. **Frontend dist must be committed:** `frontend/dist/` is served by Nginx directly. Always `npm run build` + `git add -f frontend/dist` before pushing.
2. **Backend rebuilds:** For backend Python changes, you MUST use `--build` flag in docker compose, otherwise the old code runs.
3. **Alembic migrations on server:** After adding new models, run migration inside the container: `sudo docker exec ecohealth_backend_prod alembic revision --autogenerate -m 'msg'` then `sudo docker exec ecohealth_backend_prod alembic upgrade head` (no `-it` flag via SSH).
4. **Activity.location uses PostGIS:** The `location` column is `Geography('POINT', srid=4326)`. Set it via WKT: `f"SRID=4326;POINT({longitude} {latitude})"`. Access lat/lng via `@property` methods on the model.
5. **Route polyline is stored as JSON string:** `route_polyline` is a `Text` column containing `JSON.stringify([[lat, lng], [lat, lng], ...])`. Parse it with `JSON.parse()` on the frontend.
6. **Auth flow:** Login returns `{access_token, token_type}`. All authenticated requests send `Authorization: Bearer <token>` header.
7. **Admin check:** `is_admin` boolean on User model. `get_current_active_admin` dependency in `api/deps.py` guards admin routes.
8. **Categories are dynamic:** All category emojis and names come from the `/api/categories` endpoint. Never hardcode category lists. The `Category` table is seeded with Hiking, Running, Cycling, Walking.
9. **Reviews:** Each user can only review an activity once (unique constraint). Reviews are fetched with a JOIN to get the username. Reviews can be deleted by the author or any admin.

---

**All current roadmap tasks are complete. Ask the user what feature they'd like to build next!**
