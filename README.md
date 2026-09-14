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
5. Seed missing permission rows, default roles, and the admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). Re-running seed does not strip role grants an admin already set:
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

## Deploy on AWS (ECS Express Mode)

App Runner is closed to **new** customers (as of 30 Apr 2026). Use **Amazon ECS Express Mode** instead: Docker image on Fargate + managed ALB/HTTPS.

The app image runs `prisma migrate deploy`, additive seed, then `next start` on port **8080**.

### First-time provision (local)

Creates RDS, S3, ECS roles, builds once, and creates the Express Mode service:

```
export AWS_REGION=ap-south-1
export ADMIN_EMAIL=you@your.org
./scripts/aws-provision.sh ecs-express
```

Secrets land in `.aws-deploy-secrets.local` (gitignored). Do **not** set `S3_ENDPOINT` or `S3_FORCE_PATH_STYLE` in production. Never run `npm run db:clean` or `prisma migrate reset` against RDS.

Optional Google sign-in: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and callback `https://YOUR_HOST/api/auth/callback/google`.

### Day-to-day deploys (GitHub Actions)

After the service exists, **build → ECR → ECS** runs in CI (no Docker Desktop required).

1. One-time IAM OIDC role (from a machine with AWS admin credentials):

```
export AWS_REGION=ap-south-1
export GITHUB_REPO=parmod-arora/vihe-app
./scripts/github-oidc-setup.sh
```

2. In the GitHub repo → **Settings → Secrets and variables → Actions → Variables**:
   - `AWS_ACCOUNT_ID` = your 12-digit account id (printed by the script)
   - Optional: `AWS_REGION`, `ECR_REPOSITORY`, `ECS_SERVICE` (defaults: `ap-south-1` / `vihe-app` / `vihe-app`)
3. Merge to `main`, or run **Actions → Deploy → Run workflow**.

The workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) pushes `sha-<commit>` and `latest` to ECR, then updates the Express Mode service **image only** (existing env vars stay on the service).

Local fallback if CI is unavailable: `./scripts/aws-provision.sh ecr-push` then `./scripts/aws-provision.sh ecs-express`.


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
