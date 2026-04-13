# EcoHealth - Project Master Plan

## 1. Project Vision
EcoHealth is a smart nature guide and health coach designed to encourage users to spend more time in nature. It combines personalized activity recommendations with a gamified experience to track health and progress in a fun and engaging way.

## 2. Core Functional Pillars
*   **Personalized Nature Plans:** Recommendations based on user history and physical fitness (Age, Sex, Weight, Height).
*   **The Hook (Gamification):** Earn XP and unlock "vibrant" badges. Level up as you move.
*   **Verification:** A "Trust-default" system where users submit their own activity, with an optional Geolocation toggle for verification.
*   **Dashboard:** A central hub showing activity stats, recommendation cards, and earned badges.

## 3. Tech Stack (Simplified Pro)
*   **Frontend:** React (Vite) + Vanilla CSS (Premium/Modern aesthetics).
*   **Backend:** FastAPI (Python, Asynchronous).
*   **Database:** PostgreSQL.
*   **Caching:** Redis (for < 2s dashboard loading).
*   **DevOps:** Docker & Docker Compose.
*   **AI Engine:** Integrated Python module using "Match Score" logic (User Profile vs. Activity Metadata).

## 4. Key Pages & Features
1.  **User Dashboard:** Stats charts, "Picked for You" carousel, quick navigation.
2.  **Explore:** Filterable activity list (difficulty, category), Map integration with geofencing visualization.
3.  **Profile:** Achievement history, Badge gallery (Color for unlocked, Grayscale for locked), XP bar.
4.  **Admin Portal:** Manage users, Create new activities with coordinates/images, System analytics.
5.  **Auth:** JWT-based secure login/registration with sleek "Toast" notifications.

## 5. Architectural Structure (5-Layer SoC)
1.  **Presentation Layer:** React-based SPA.
2.  **API Layer:** FastAPI with JWT Auth middleware.
3.  **Business Logic:** Recommendation Engine and Gamification handler (XP/Level logic).
4.  **Domain Layer:** Core models (User, Activity, Badge, Achievement).
5.  **Infrastructure:** Dockerized Postgres, Redis, and local file storage.

## 6. Design Language
*   **Vibe:** Clean, Organic, Modern.
*   **Primary Colors:** Natural greens, soft neutrals, vibrant achievement accents.
*   **UI Trends:** Glassmorphism, smooth micro-animations, skeleton loaders.

## 7. Team Collaboration & Workflow (GitHub)
*   **Repository:** `yavsanmahmutcan8-source/EcoHealth`
*   **Team:** 2 Developers working in parallel.
*   **Git Strategy:** 
    *   **Feature Branches:** Never push directly to `main`. Create `feature/your-task` branches.
    *   **Pull Requests (PRs):** Use GitHub PRs for code reviews before merging into `main`.
    *   **Sync Rules:** Always `git pull origin main` before starting a new task to avoid conflicts.
*   **Environment Parity:** Both developers MUST use the provided `docker-compose.yml` to ensure consistent databases and environments.

## 8. API & Communication
*   **Documentation:** FastAPI's automatic Swagger UI (accessible at `/docs`) will be the contract between Frontend and Backend developers.
*   **Consistency:** All API responses will follow a standard JSON structure with success/error flags.
*   **Authentication:** JWT tokens stored in the browser's `localStorage` and sent in the `Authorization` header.

## 9. Implementation Roadmap (Phased)
1.  **Phase 1 - Scaffolding:** Setup Docker, FastAPI skeleton, and React (Vite) structure.
2.  **Phase 2 - Core Auth:** User registration, Login, and JWT middleware.
3.  **Phase 3 - Activity Engine:** Admin can create routes; Explore page can list them.
4.  **Phase 4 - Gamification:** XP logic, Badge awarding, and the User Dashboard.
5.  **Phase 5 - Polish:** Animations, Map visualizations, and final CSS refinements.
