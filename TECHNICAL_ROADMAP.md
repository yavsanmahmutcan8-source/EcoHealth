# EcoHealth - Technical Roadmap & Task Split

This document tracks our ongoing progress. As tasks are completed, they should be checked off `[x]` and a brief note can be added alongside them explaining any key decisions or changes.

## Guiding Principles for Collaboration
1.  **Independence:** Tasks are designed so Developer A and Developer B do not block each other. 
2.  **API Contracts:** Backend tasks should first define the expected JSON request/response formats via FastAPI Swagger (`/docs`). Frontend can use mock data until the backend endpoints are fully ready.
3.  **Communication:** If your task requires a change in the other developer's domain, open an issue/discussion.

---

## 2. Tech Stack & Library Specifications

To ensure consistency across the team, all implementations MUST use the following specified technologies and libraries:

**Frontend (Developer B's Primary Domain)**
*   **Language:** JavaScript (ES6+ standard) / React JSX
*   **Framework:** React 18+ created via [Vite](https://vitejs.dev/)
*   **Styling:** Vanilla CSS (CSS Modules allowed for scoping). Avoid heavy component libraries to allow for custom "premium" designs.
*   **Routing:** `react-router-dom` v6
*   **State Management:** `zustand` (Preferred for simplicity over Redux) OR React Context API.
*   **HTTP/API Client:** `axios`
*   **Icons:** `lucide-react` or `react-icons`

**Backend (Developer A's Primary Domain)**
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

## Developer A (Lead Dev - Complex Logic & Architecture)

**Phase 1: Infrastructure & Core Backend**
- [x] Set up the Monorepo folder structure (`/frontend`, `/backend`) and initial `docker-compose.yml` for Postgres & Redis.
- [x] Initialize FastAPI project with JWT Authentication Middleware.
- [x] Design and implement PostgreSQL Database Schema using SQLAlchemy (Users, Activities, Achievements).
- [x] Setup Alembic for database migrations.

**Phase 2: Complex Business Logic**
- [ ] Implement the Gamification Engine Engine (Calculate XP, Level progression logic).
- [ ] Implement the "Match Score" Recommendation Engine module (pairing user fitness/history with activities).
- [ ] Build the "Proof of Presence" verification logic (handling user submissions and optional Geolocation validation).

**Phase 3: Advanced Integrations**
- [ ] Develop the Admin Portal backend endpoints (creation of complex route objects).
- [ ] Connect and optimize Redis caching for User Dashboard statistics.

**Phase 4: Server Deployment (Ubuntu)**
- [ ] Create `docker-compose.prod.yml` configured for production (no hot-reloading, exposed ports restricted).
- [ ] Set up an Nginx container to serve the compiled frontend (`npm run build`) and route `/api` traffic to FastAPI.
- [ ] Configure environment variables `.env` for production secrets, DB URLs, and IP/Domain settings.
- [ ] Depoy to Ubuntu server, set up SSH access, and start the system.

---

## Developer B (Teammate - UI/UX & Standard Interfaces)

**Phase 1: Frontend Scaffolding & Shared Components**
- [ ] Initialize React (Vite) frontend project.
- [ ] Setup the base CSS structure (Color palette, variables, global styles - "Nature & Health" theme).
- [ ] Build reusable UI components (Buttons, Inputs, Cards, "Toast" notifications, Skeleton Loaders).
- [ ] Build Authentication UI (Login and Registration forms).

**Phase 2: View Construction (Mock Data)**
- [ ] Build the User Dashboard UI (Stats charts, "Picked for You" carousel, XP progress bar module).
- [ ] Build the Explore Page UI (Filterable list layout, Activity detail cards).
- [ ] Build the Profile Page UI (Badge gallery showing color/grayscale distinction).

**Phase 3: Integration & Admin Frontend**
- [ ] Connect Frontend React pages to Backend API endpoints using Axios/Fetch (e.g., retrieving actual user data).
- [ ] Implement state management (React Context or Zustand) to keep user session/XP points synchronized across the app.
- [ ] Build the Admin Portal UI (Simple table views for users, basic forms for adding new activities).

---

## Completed Tasks Log
*(Add completed tasks here with notes... e.g.,)*
*   ~~[x] Connected SSH to GitHub and initialized repo.~~
*   ~~[x] Created `PROJECT_MASTER_PLAN.md`.~~
