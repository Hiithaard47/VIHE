# Vihe Attendance

Attendance app for teachers and admins built on Next.js, Prisma, Postgres, and Auth.js.

## Roles & permissions

Access is driven by a flexible RBAC model, not hardcoded role checks:

- **Permission** — an atomic capability (`courses.manage`, `attendance.mark`, ...). Defined in [src/lib/permissions.ts](src/lib/permissions.ts).
- **Role** — a named bundle of permissions (`Admin`, `Teacher` by default). Admins can create new roles and edit any role's permissions from `/admin/roles`.
- **User** — has one or more roles.

`Admin` and `Teacher` are seeded as system roles (can't be deleted) but their permission grants can still be edited, and new roles can be added freely — that's the "user matrix" the admin configures later.

## Setup

1. Copy `.env.example` to `.env`. The default `DATABASE_URL` matches the Postgres started by `docker-compose.yml` below — change it if you're pointing at a different database. Set `AUTH_SECRET` (`npx auth secret`), and optionally `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for Google sign-in. Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the bootstrap admin account.
2. Start a local Postgres:
   ```
   docker compose up -d
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create the database schema:
   ```
   npx prisma migrate dev --name init
   ```
5. Seed permissions, default roles, and the admin user:
   ```
   npm run db:seed
   ```
6. Run the app:
   ```
   npm run dev
   ```
7. Sign in at `/login` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, then use `/admin/teachers` to create teacher accounts and assign roles, `/admin/courses` to add courses and assign teachers, `/admin/students` to add students and enroll them, and `/admin/roles` to adjust the permission matrix.

The Postgres container persists data in a named Docker volume (`vihe-app-db-data`) across restarts. `docker compose down -v` wipes it if you want a clean slate (re-run steps 4–5 after).

Teachers sign in the same way (credentials or Google, if an admin already created their account) and land on `/teacher`, where they can open an assigned course, create a class session, and mark attendance for enrolled students.

There is no self sign-up: a Google account only works if an admin has already created a matching `User` record for that email.

## Testing

End-to-end coverage lives in [e2e/](e2e/) using Playwright — auth & access control, every admin CRUD screen (teachers, courses, students, roles/permission matrix), the public apply form (including the honeypot), and the full teacher flow (course visibility, session creation, attendance marking with autosave/search/mark-all-present).

```
npx playwright install chromium   # first time only
npm run test:e2e                  # headless run
npm run test:e2e:ui               # interactive UI mode
```

Tests run against the same dev database from Setup — `docker compose up -d` and a seeded admin account (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) are all they need. If nothing is already running on `localhost:3000`, Playwright starts `npm run dev` itself. Every test generates its own uniquely-suffixed data (emails, course codes, roll numbers), so the suite is safe to re-run repeatedly without resetting the database — nothing needs to be cleaned up between runs.

Specs run serially (`workers: 1`) since several of them mutate shared admin state (roles, courses) against one real database — parallelizing would risk one test's writes racing another's reads.
