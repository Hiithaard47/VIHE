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
2. Start local Postgres and MinIO:
   ```
   docker compose up -d
   ```
   MinIO is the local S3 stand-in (`http://localhost:9000`, console `http://localhost:9001`). Production uses AWS S3 with the same `S3_*` variables (omit `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE`).
3. Install dependencies:
   ```
   npm install
   ```
4. Create the database schema (local; may prompt to create a migration):
   ```
   npm run migrate
   ```
   On CI or a host that only applies existing migrations:
   ```
   npm run db:migrate
   ```
5. Seed permissions, default roles, and the admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`):
   ```
   npm run db:seed
   ```
   Or one shot: apply migrations, seed admin, and production-build:
   ```
   npm run ci
   ```
6. Run the app:
   ```
   npm run dev
   ```
7. Sign in at `/login` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`, then use `/admin/teachers` to create teacher accounts and assign roles, `/admin/courses` to add courses and assign teachers, `/admin/students` to add students and enroll them, and `/admin/roles` to adjust the permission matrix.

The Postgres container persists data in a named Docker volume (`vihe-app-db-data`) across restarts. To wipe **data** and re-apply migrations with an empty schema (no seed):

```
npm run db:clean
```

That drops `DATABASE_URL` and is not reversible. `docker compose down -v` also wipes the volume; re-run migrate + seed after.

Teachers sign in the same way (credentials or Google, if an admin already created their account) and land on `/teacher`, where they can open an assigned course, create a class session, mark attendance, and upload PDF/image files for that session.

Students sign in with the email and portal password set by an admin, then download files from sessions in their batch.

There is no self sign-up: a Google account only works if an admin has already created a matching `User` record for that email.

## Testing

End-to-end coverage lives in [e2e/](e2e/) using Playwright — auth & access control, every admin CRUD screen (teachers, courses, students, roles/permission matrix), the public apply form (including the honeypot), and the full teacher flow (course visibility, session creation, attendance marking with autosave/search/mark-all-present).

```
npx playwright install chromium   # first time only
npm run test:e2e                  # headless run
npm run test:e2e:ui               # interactive UI mode
```

E2E tests use a **separate** Postgres database (`vihe_app_test`, via `TEST_DATABASE_URL`) and a dedicated Next server on port **3001**. They do not reuse `npm run dev` / `npm start` on port 3000, so a running app against `vihe_app` is left alone.

`docker compose up -d` creates both databases on a fresh volume. If the volume already exists, `npm run test:e2e:prepare` creates `vihe_app_test` if needed, then migrates and seeds it (same `ADMIN_EMAIL` / `ADMIN_PASSWORD` as `.env`).

Every test generates its own uniquely-suffixed data (emails, course codes, roll numbers), so the suite is safe to re-run without resetting the test database.

Specs run serially (`workers: 1`) since several of them mutate shared admin state (roles, courses) against that one test database — parallelizing would risk one test's writes racing another's reads.
