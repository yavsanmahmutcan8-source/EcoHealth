# EcoHealth - Technical Roadmap & Task Split

This document tracks our ongoing progress. As tasks are completed, they should be checked off `[x]` and a brief note can be added alongside them explaining any key decisions or changes.

## Guiding Principles for Collaboration
1.  **Independence:** Tasks are designed so Can and Melikşah do not block each other. 
2.  **API Contracts:** Backend tasks should first define the expected JSON request/response formats via FastAPI Swagger (`/docs`). Frontend can use mock data until the backend endpoints are fully ready.
3.  **Communication:** If your task requires a change in the other developer's domain, open an issue/discussion.

---

## 2. Tech Stack & Library Specifications

To ensure consistency across the team, all implementations MUST use the following specified technologies and libraries:

**Frontend (Melikşah's Primary Domain)**
*   **Language:** JavaScript (ES6+ standard) / React JSX
*   **Framework:** React 18+ created via [Vite](https://vitejs.dev/)
*   **Styling:** Vanilla CSS (CSS Modules allowed for scoping). Avoid heavy component libraries to allow for custom "premium" designs.
*   **Routing:** `react-router-dom` v6
*   **State Management:** `zustand` (Preferred for simplicity over Redux) OR React Context API.
*   **HTTP/API Client:** `axios`
*   **Icons:** `lucide-react` or `react-icons`

**Backend (Can's Primary Domain)**
*   **Language:** Python 3.10+
*   **Framework:** FastAPI
*   **Server/ASGI:** `uvicorn`
*   **Database ORM:** `SQLAlchemy` (v2 style preferred)
*   **Database Migrations:** `alembic`
*   **Authentication:** `PyJWT` for token generation/validation, `passlib` (with bcrypt) for password hashing.
*   **Caching/Data Store:** `redis-py`
*   **Environment Variables:** `pydantic-settings`

**Infrastructure & Database**
*   **Relational DB:** PostgreSQL 15+
*   **In-Memory Store:** Redis 7+
*   **Containerization:** Docker & Docker Compose
*   **Production Deployment (Ubuntu Linux):** Nginx as a reverse proxy (to serve React files and proxy API requests to FastAPI), managed entirely via a production `docker-compose.prod.yml` file.

---

## Can (Lead Dev - Complex Logic & Architecture)

**Phase 1: Infrastructure & Core Backend**
- [x] Set up the Monorepo folder structure (`/frontend`, `/backend`) and initial `docker-compose.yml` for Postgres & Redis.
- [x] Initialize FastAPI project with JWT Authentication Middleware.
- [x] Design and implement PostgreSQL Database Schema using SQLAlchemy (Users, Activities, Achievements).
- [x] Setup Alembic for database migrations.

**Phase 2: Complex Business Logic**
- [x] Implement the Gamification Engine Engine (Calculate XP, Level progression logic).
- [x] Implement the "Match Score" Recommendation Engine module (pairing user fitness/history with activities).
- [x] Build the "Proof of Presence" verification logic (handling user submissions and optional Geolocation validation).

**Phase 3: Advanced Integrations**
- [x] Develop the Admin Portal backend endpoints (creation of complex route objects).
- [x] Connect and optimize Redis caching for User Dashboard statistics.

**Phase 4: Server Deployment (Ubuntu)**
- [x] Create `docker-compose.prod.yml` configured for production (no hot-reloading, exposed ports restricted).
- [x] Set up an Nginx container to serve the compiled frontend (`npm run build`) and route `/api` traffic to FastAPI.
- [x] Configure environment variables `.env` for production secrets, DB URLs, and IP/Domain settings.
- [x] Depoy to Ubuntu server, set up SSH access, and start the system.

**Phase 5: Maps & Activity Progression**
- [x] Enhance database schemas and DTOs to store map data for Activities (GPS coordinates, route polylines, map boundaries).
- [x] Implement robust backend REST APIs to serve and filter location-based activities for frontend map consumption.
- [x] Build the "Complete Activity" endpoint: Process completion requests, trigger the Gamification Engine to award XP/Badges, and securely persist user progress.

**Phase 6: Geospatial Engine & Advanced Admin Backend (New)**
- [x] Integrate PostGIS (via `GeoAlchemy2`) to natively support advanced spatial queries (City-level boundaries, Geographic Bounding Boxes, Radius Searches).
- [x] Build rigorous Admin-Only REST endpoints: Full CRUD with draft/publish visibility states, strict manual XP/Badge assignment, and Route drawing data (GeoJSON/Polylines).
- [x] Develop the localized discovery endpoint: Filter activities dynamically based on the user's provided latitude, longitude, and map zoom radius.

**Phase 7: Dynamic Categories & Ratings/Comments Engine**
- [x] **Category System**: Create a `Category` database model with fields: `id`, `name`, `emoji`, `color`. Add Alembic migration. Update `Activity.category` to be a foreign key to the `Category` table.
- [x] **Admin Category CRUD**: Build REST endpoints (`POST /api/admin/categories`, `GET /api/categories`, `PUT`, `DELETE`) to let admins create/edit/delete categories with custom emojis. Seed initial categories (Hiking 🥾, Running 🏃, Cycling 🚵, Walking 🚶).
- [x] **Review & Rating Model**: Create `Review` database model with fields: `id`, `user_id` (FK), `activity_id` (FK), `rating` (1-5 stars), `comment` (text), `created_at`. Add unique constraint on `(user_id, activity_id)` so each user can only review once per activity.
- [x] **Review REST API**: Build endpoints: `POST /api/activities/{id}/reviews`, `GET /api/activities/{id}/reviews?sort=rating|date&order=asc|desc`, `DELETE /api/reviews/{id}`. Calculate and cache aggregate `average_rating` and `review_count` on the Activity model.
- [x] **Activity Schema Update**: Add `average_rating` and `review_count` fields to `ActivityOut` so frontend can display ratings on cards without extra API calls.

---

## Melikşah (Teammate - UI/UX & Standard Interfaces)

**Phase 1: Frontend Scaffolding & Shared Components**
- [x] Initialize React (Vite) frontend project.
- [x] Setup the base CSS structure (Color palette, variables, global styles - "Nature & Health" theme).
- [x] Build reusable UI components (Buttons, Inputs, Cards, "Toast" notifications, Skeleton Loaders).
- [x] Build Authentication UI (Login and Registration forms).
- [x] Implement Global Dark Mode Toggle.

**Phase 2: View Construction (Mock Data)**
- [x] Build the User Dashboard UI (Stats charts, "Picked for You" carousel, XP progress bar module).
- [x] Build the Explore Page UI (Filterable list layout, Activity detail cards).
- [x] Build the Profile Page UI (Badge gallery showing color/grayscale distinction).

**Phase 3: Integration & Admin Frontend**
- [x] Connect Frontend React pages to Backend API endpoints using Axios/Fetch (e.g., retrieving actual user data).
- [x] Setup secure backend authentication logic and Redis caching.
- [x] Develop the gamification sub-service logic (awards/badges calculation).
- [x] Implement state management (React Context or Zustand) to keep user session/XP points synchronized across the app.
- [x] Build the Admin Portal UI (Simple table views for users, basic forms for adding new activities).

**Phase 4: Map Integration & Actionable UI**
- [x] Integrate a mapping library (e.g., Google Maps API or Leaflet.js) to visually display activity routes and details on the app.
- [x] Build the "Active Session" experience: Prompt for user location permissions and implement the "Complete Task" interaction button.
- [x] Design and implement dynamic success animations/modals that visually reward the user with earned XP and new Badges upon activity completion.

**Phase 5: Geographical Discovery & Interactive Admin Builder (New)**
- [x] Build an interactive "Admin Route Builder" UI using Map plugins (click-to-draw paths, drag-and-drop markers for custom activity start/end points).
- [x] Design the comprehensive Admin Dashboard: Data tables with bulk-publish actions, and detailed forms to assign dynamic XP multipliers and Badge SVGs to activities.
- [x] Implement localized User Discovery: Auto-request browser Geolocation, focus the default Map View to the user's city/neighborhood, and silently reload local activities as the user pans the map.

**Phase 6: Dynamic Categories UI & Ratings/Comments (New)**
- [x] **Admin Category Manager**: Build a new tab in the Admin Portal with a form to create categories (name + emoji picker). Display existing categories in an editable list with delete option. Wire to backend `GET/POST/PUT/DELETE /api/admin/categories`.
- [x] **Dynamic Category Usage**: Replace all hardcoded category `<select>` dropdowns (Admin Route Builder, Explore filter) with dynamically fetched categories from the API. Replace hardcoded emoji mappings with the category's stored emoji.
- [x] **Star Rating Component**: Build a reusable `<StarRating>` component (1-5 interactive stars with half-star hover preview, gold fill animation). Use it for both submitting and displaying ratings.
- [x] **Activity Comments Section**: Below each activity preview modal, add a collapsible "Reviews" section. Show the aggregate star average + count at the top. List individual reviews with username, star rating, comment text, and date.
- [x] **Comment Submission Form**: Add a form inside the activity modal for logged-in users to write a review (star rating + text comment). Show a "You already reviewed this" state if the user has already submitted a review.
- [x] **Comment Sorting UI**: Add sort controls (dropdown or toggle buttons) above the comments list: sort by "Highest Rated", "Lowest Rated", "Newest First", "Oldest First". Fetch sorted results from the backend API.

---

## Phase 8 — Backend: Smart Badge Engine, Content Population & Profile Customization

### 8A. Content Population: More Categories & Badges

- [x] **Seed Additional Categories**: Add at least 10 new categories beyond the initial 4. Examples: Swimming 🏊, Yoga 🧘, Rock Climbing 🧗, Kayaking 🛶, Skateboarding 🛹, Skiing ⛷️, Trail Running 🏃‍♂️, Nature Walk 🌿, Bird Watching 🐦, Gardening 🌱. Create via a one-time seed script on the server.

- [x] **Badge Definition Table**: Create a `BadgeDefinition` database model to replace the hardcoded `AVAILABLE_BADGES` list:
  - Fields: `id` (str, PK like `"weekend_warrior"`), `name`, `description`, `emoji`, `color`, `condition_type` (enum), `condition_config` (JSON).
  - `condition_type` is an enum: `ACTIVITY_COUNT`, `TOTAL_XP`, `LEVEL_REACHED`, `CATEGORY_COUNT`, `STREAK_DAYS`, `TIME_OF_DAY`, `WEEKEND_COUNT`, `TOTAL_DISTANCE`, `FIRST_REVIEW`, `MULTI_CATEGORY`.
  - `condition_config` stores the parameters as JSON, e.g. `{"count": 3}` for WEEKEND_COUNT, `{"before_hour": 7}` for TIME_OF_DAY, `{"category": "Hiking", "count": 5}` for CATEGORY_COUNT.
  - Add Alembic migration. Seed 15–20 badges into the table (see badge list below).

- [x] **Badge Seed Data** — Populate the `BadgeDefinition` table with these achievements:

  | ID | Name | Description | Condition Type | Config |
  |----|------|-------------|---------------|--------|
  | `first_step` | First Step | Complete your first activity | ACTIVITY_COUNT | `{"count": 1}` |
  | `high_five` | High Five | Complete 5 activities | ACTIVITY_COUNT | `{"count": 5}` |
  | `marathon_runner` | Marathon Runner | Complete 20 activities | ACTIVITY_COUNT | `{"count": 20}` |
  | `centurion` | Centurion | Complete 100 activities | ACTIVITY_COUNT | `{"count": 100}` |
  | `weekend_warrior` | Weekend Warrior | Complete 3 activities on weekends | WEEKEND_COUNT | `{"count": 3}` |
  | `early_bird` | Early Bird | Complete an activity before 7 AM | TIME_OF_DAY | `{"before_hour": 7}` |
  | `night_owl` | Night Owl | Complete an activity after 9 PM | TIME_OF_DAY | `{"after_hour": 21}` |
  | `trailblazer` | Trailblazer | Reach Level 5 | LEVEL_REACHED | `{"level": 5}` |
  | `elite_explorer` | Elite Explorer | Reach Level 10 | LEVEL_REACHED | `{"level": 10}` |
  | `nature_lover` | Nature Lover | Earn 1000 Total XP | TOTAL_XP | `{"xp": 1000}` |
  | `xp_legend` | XP Legend | Earn 5000 Total XP | TOTAL_XP | `{"xp": 5000}` |
  | `hike_master` | Hike Master | Complete 5 Hiking activities | CATEGORY_COUNT | `{"category": "Hiking", "count": 5}` |
  | `cyclist` | Road Cyclist | Complete 5 Cycling activities | CATEGORY_COUNT | `{"category": "Cycling", "count": 5}` |
  | `jack_of_all_trails` | Jack of All Trails | Complete activities in 3 different categories | MULTI_CATEGORY | `{"count": 3}` |
  | `reviewer` | Helpful Explorer | Write your first review | FIRST_REVIEW | `{}` |
  | `streak_3` | On Fire | Complete activities 3 days in a row | STREAK_DAYS | `{"days": 3}` |
  | `streak_7` | Unstoppable | Complete activities 7 days in a row | STREAK_DAYS | `{"days": 7}` |

- [x] **Admin Badge Management API**: `GET /api/badges` (list all badge definitions, public). `POST/PUT/DELETE /api/admin/badges` for admin CRUD.

### 8B. Smart Badge Achievement Engine

- [x] **ActivityCompletion Log Table**: Create a `CompletionLog` model: `id`, `user_id` (FK), `activity_id` (FK), `category` (str — snapshot at completion time), `completed_at` (datetime with timezone). This is the **history table** that powers all badge condition evaluations.

- [x] **Badge Evaluator Service** (`services/badge_evaluator.py`): A stateless function `evaluate_badges(user, db) -> List[BadgeDefinition]` that:
  1. Loads all `BadgeDefinition` rows from the DB.
  2. Loads the user's `CompletionLog` entries.
  3. Loads the user's current badge list.
  4. For each badge the user doesn't have, runs the appropriate condition check:
     - `ACTIVITY_COUNT`: `len(completions) >= config.count`
     - `TOTAL_XP`: `user.xp >= config.xp`
     - `LEVEL_REACHED`: `user.level >= config.level`
     - `CATEGORY_COUNT`: `len([c for c in completions if c.category == config.category]) >= config.count`
     - `WEEKEND_COUNT`: `len([c for c in completions if c.completed_at.weekday() in (5,6)]) >= config.count`
     - `TIME_OF_DAY`: Check if any completion's `completed_at.hour` satisfies `< before_hour` or `>= after_hour`
     - `STREAK_DAYS`: Check max consecutive days with at least 1 completion
     - `MULTI_CATEGORY`: `len(set(c.category for c in completions)) >= config.count`
     - `FIRST_REVIEW`: `SELECT COUNT(*) FROM review WHERE user_id = user.id` >= 1
  5. Returns the list of newly earned `BadgeDefinition` objects.

- [x] **Hook into Activity Completion**: Update `POST /api/activities/{id}/complete` to:
  1. Create a `CompletionLog` entry (with category snapshot + timestamp).
  2. Call `evaluate_badges(user, db)`.
  3. Persist any newly earned badges to `user.badges`.
  4. Return the list of newly unlocked badges in the response (for celebration animation).

- [x] **Hook into Review Submission**: After a user submits their first review (`POST /api/activities/{id}/reviews`), also call `evaluate_badges()` to check the `FIRST_REVIEW` badge.

### 8C. User Profile Customization

- [x] **User Model Update**: Add columns to `User`:
  - `display_name` (String, nullable) — optional custom display name, falls back to `username`
  - `bio` (Text, nullable) — short bio/tagline
  - `avatar_url` (String, nullable) — URL/path to uploaded profile photo
  - `total_distance_km` (Float, default=0) — cumulative distance (for future badge conditions)
  - Add Alembic migration.

- [x] **Profile Update API**: `PUT /api/users/me/profile` — allows updating `display_name`, `bio`, `username` (with uniqueness check). Authenticated users only.

- [x] **Avatar Upload API**: `POST /api/users/me/avatar` — accepts multipart file upload (JPEG/PNG, max 2MB). Store in `static/avatars/{user_id}.jpg` on the server. Serve via Nginx at `/static/avatars/`. Update `user.avatar_url` to the served path.

- [x] **Update UserOut Schema**: Add `display_name`, `bio`, `avatar_url`, and `total_distance_km` fields to `UserOut` so the frontend can consume them.

---

## Phase 7 — Frontend: Badge Gallery, Profile Editor & Achievement Toasts

### 7A. Profile Customization UI

- [x] **Profile Editor Modal**: Add an "Edit Profile" button on the Profile page. Opens a modal with:
  - Avatar upload (click-to-select image, preview before upload, circular crop preview)
  - Display name field
  - Username field (with "taken" validation on blur)
  - Bio textarea (max 160 characters, character counter)
  - Save button that calls `PUT /api/users/me/profile` and `POST /api/users/me/avatar`

- [x] **Avatar Display Everywhere**: Replace the generic `<User>` icon with the actual avatar image across: Profile page header, Navbar avatar circle, Review cards (reviewer avatar). Fallback to initial letter or icon if no avatar set.

- [x] **Update authStore**: Add `avatar_url`, `display_name`, `bio` to the `formattedUser` mapping. After profile update, re-fetch user data.

### 7B. Real Badge Gallery

- [x] **Fetch Badge Definitions**: On Profile page mount, `GET /api/badges` to load all available badges with their names, descriptions, emojis, and colors. Cross-reference with `user.badges` (list of earned badge IDs) to determine locked/unlocked state.

- [x] **Dynamic Badge Cards**: Replace the `MOCK_BADGES` array with real data. Render each badge with:
  - Emoji as the icon (from `BadgeDefinition.emoji`)
  - Color background (from `BadgeDefinition.color`)
  - Locked state: grayscale + reduced opacity + "🔒 Locked" label
  - Unlocked state: full color + subtle glow animation
  - Progress hint: For count-based badges, show "2/5 completed" below the description.

- [x] **Badge Progress Calculation**: For badges that are count-based (ACTIVITY_COUNT, CATEGORY_COUNT, WEEKEND_COUNT, STREAK_DAYS), the frontend should show progress. Add a `GET /api/users/me/badge-progress` endpoint that returns the current count for each badge condition, so the frontend can display "3/5 activities completed" etc.

### 7C. Achievement Celebration

- [x] **Badge Unlock Toast**: When the `/complete` endpoint returns `newly_unlocked_badges`, display a premium animated toast/overlay for each badge:
  - Badge emoji + name + description in a golden glowing card
  - Confetti burst animation
  - Slide-in from top with bounce effect
  - Auto-dismiss after 5 seconds or tap to close

- [x] **Badge Unlock in Session Page**: On the ActivitySessionPage's completion screen, display newly earned badges alongside the XP and level-up celebration that already exists.

---

## Phase 9 — Notification System (Planned)

### 9A. Backend: Notification Engine
- [x] **Notification Model**: Create `Notification` model with fields: `id`, `user_id` (FK), `type` (enum: `BADGE_EARNED`, `LEVEL_UP`, `NEW_ACTIVITY`, `SYSTEM`), `title`, `message`, `is_read` (boolean, default `False`), `created_at`.
- [x] **Notification Endpoints**:
  - `GET /api/notifications`: Retrieve a user's notifications, sorted by newest first.
  - `PUT /api/notifications/{id}/read`: Mark a specific notification as read.
  - `PUT /api/notifications/read-all`: Mark all unread notifications as read.
- [x] **System Triggers**: 
  - Hook into `evaluate_badges` to create `BADGE_EARNED` notifications.
  - Hook into `process_activity_completion` to create `LEVEL_UP` notifications when `leveled_up` is true.
  - (Optional) Admin trigger to send `SYSTEM` broadcasts to all users.

### 9B. Frontend: Notification UI
- [x] **Notification Store** (`notificationStore.js`): State management for fetching notifications and keeping track of the unread count. Optionally set up short-polling (every 30s) or WebSockets for real-time updates.
- [x] **Navbar Bell Integration**:
  - Add a red unread badge indicator to the `Bell` icon in the Navbar if `unreadCount > 0`.
  - When the Bell icon is clicked, open a dropdown menu or slide-out panel showing the latest notifications.
- [x] **Notification Panel/Dropdown**:
  - Render notification items with distinct icons based on `type` (e.g., 🏆 for badges, ⬆️ for level up).
  - Unread notifications should have a subtle background highlight.
  - Clicking a notification marks it as read via API and updates the local store.
  - Include a "Mark all as read" button.

---

## Completed Tasks Log
*(Add completed tasks here with notes... e.g.,)*
*   ~~[x] Connected SSH to GitHub and initialized repo.~~
*   ~~[x] Created `PROJECT_MASTER_PLAN.md`.~~

