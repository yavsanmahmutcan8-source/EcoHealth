# EcoHealth - Technical Roadmap & Task Split

This document tracks our ongoing progress. As tasks are completed, they should be checked off `[x]` and a brief note can be added alongside them explaining any key decisions or changes.

## Guiding Principles for Collaboration
1.  **Independence:** Tasks are designed so Developer A and Developer B do not block each other. 
2.  **API Contracts:** Backend tasks should first define the expected JSON request/response formats via FastAPI Swagger (`/docs`). Frontend can use mock data until the backend endpoints are fully ready.
3.  **Communication:** If your task requires a change in the other developer's domain, open an issue/discussion.

---

## Developer A (Lead Dev - Complex Logic & Architecture)

**Phase 1: Infrastructure & Core Backend**
- [ ] Set up the Monorepo folder structure (`/frontend`, `/backend`) and initial `docker-compose.yml` for Postgres & Redis.
- [ ] Initialize FastAPI project with JWT Authentication Middleware.
- [ ] Design and implement PostgreSQL Database Schema using SQLAlchemy (Users, Activities, Achievements).
- [ ] Setup Alembic for database migrations.

**Phase 2: Complex Business Logic**
- [ ] Implement the Gamification Engine Engine (Calculate XP, Level progression logic).
- [ ] Implement the "Match Score" Recommendation Engine module (pairing user fitness/history with activities).
- [ ] Build the "Proof of Presence" verification logic (handling user submissions and optional Geolocation validation).

**Phase 3: Advanced Integrations**
- [ ] Develop the Admin Portal backend endpoints (creation of complex route objects).
- [ ] Connect and optimize Redis caching for User Dashboard statistics.
- [ ] Finalize Docker builds for production deployment.

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
