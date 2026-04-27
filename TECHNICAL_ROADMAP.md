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
- [ ] Build the "Active Session" experience: Prompt for user location permissions and implement the "Complete Task" interaction button.
- [ ] Design and implement dynamic success animations/modals that visually reward the user with earned XP and new Badges upon activity completion.

**Phase 5: Geographical Discovery & Interactive Admin Builder (New)**
- [ ] Build an interactive "Admin Route Builder" UI using Map plugins (click-to-draw paths, drag-and-drop markers for custom activity start/end points).
- [ ] Design the comprehensive Admin Dashboard: Data tables with bulk-publish actions, and detailed forms to assign dynamic XP multipliers and Badge SVGs to activities.
- [ ] Implement localized User Discovery: Auto-request browser Geolocation, focus the default Map View to the user's city/neighborhood, and silently reload local activities as the user pans the map.

---

## Completed Tasks Log
*(Add completed tasks here with notes... e.g.,)*
*   ~~[x] Connected SSH to GitHub and initialized repo.~~
*   ~~[x] Created `PROJECT_MASTER_PLAN.md`.~~
