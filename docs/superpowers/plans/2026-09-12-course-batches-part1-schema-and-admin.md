# Course Batches — Part 1: Schema, Rewire, Admin UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `CourseBatch` so a course can have morning/evening (etc.) batches with separate teachers and rosters, and ship the Admin UI to manage them — while migrating existing data and keeping the teacher app working via each course’s batches.

**Architecture:** Move teachers, enrollments, schedule slots, and class sessions from `Course` onto `CourseBatch`. Shared course identity and attendance policy stay on `Course`. A pure enrollment helper enforces one batch per student per course. Admin gets `/admin/courses/[courseId]` (Batches / Details / Policy) and `/admin/courses/[courseId]/batches/[batchId]` (Overview / Teachers / Roster). Teacher write paths resolve a batch id (Part 2 moves URLs to `/teacher/batches/[batchId]`).

**Tech Stack:** Next.js 16.3.1 (App Router, server actions), Prisma 6.19.3 + Postgres 16, Auth.js 5 beta, Zod 4.4.3, Tailwind 4, Playwright 1.62, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-course-batches-design.md`

**Scope:** This is plan 1 of 2. Plan 2 moves the teacher workspace to `/teacher/batches/[batchId]/…`, updates teacher landing labels, and finishes teacher-facing e2e. After Part 1, teachers still use `/teacher/courses/[courseId]` but actions operate on the batch they are assigned to for that course (or the sole Default batch for admins).

## Global Constraints

- This repo is a git repository. Every task ends in an SSH-signed commit (`commit.gpgsign=true`). Never pass `--no-gpg-sign`.
- `AGENTS.md` applies: Next.js 16 — read `node_modules/next/dist/docs/` before routing/layout/server-action work. `params` is a `Promise` and must be awaited.
- Tailwind tokens from `src/app/globals.css`: `ink`, `accent`, `accent-dark`, `canvas`, `card`, `muted`, `hairline`, `input`. No raw hex, no default Tailwind greys.
- Server actions report via `flashUrl` + `<FlashBanner />` (see `src/app/admin/courses/actions.ts`).
- Playwright: `workers: 1`. Use `unique()` from `e2e/helpers.ts` for unique columns.
- Every server action begins with a permission guard. UI hiding is not access control.
- Default batch name is exactly `Default` (capital D).
- YAGNI: no new permission keys; no admin Schedule/Sessions tabs; approve-application does not add a batch picker.

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `CourseBatch`, `BatchTeacher`, `BatchEnrollment`; slots/sessions on `batchId` |
| `prisma/migrations/…/migration.sql` | Create tables, backfill Default batches, drop old joins |
| `src/lib/enrollment.ts` | `enrollStudentInBatch`, `unenrollStudentFromBatch` |
| `src/lib/enrollment.test.ts` | Unit tests for one-batch-per-course rule |
| `src/lib/rbac.ts` | `canManageBatch`, `requireBatchAccess`, `canConfigureBatch`, `requireBatchConfigure` |
| `src/lib/batches.ts` | `DEFAULT_BATCH_NAME`, `resolveTeacherBatchForCourse` |
| `src/app/admin/courses/*` | List + create; detail layout/tabs; batch CRUD |
| `src/app/admin/students/*` | Course → batch enrollment pickers |
| `e2e/db.ts` | Fixtures create Default batch + batch teachers/enrollments |
| Teacher course pages (Part 1) | Use batch-scoped Prisma queries via resolver |

---

### Task 1: Schema + data migration

Replace course-level teachers/enrollments/slots/sessions with batch-scoped equivalents. Migrate every existing course to one `Default` batch.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_course_batches/migration.sql` (via `prisma migrate dev`)

**Interfaces:**
- Consumes: existing `Course`, `CourseTeacher`, `CourseEnrollment`, `CourseScheduleSlot`, `ClassSession`.
- Produces: models `CourseBatch`, `BatchTeacher`, `BatchEnrollment`; `CourseScheduleSlot.batchId`; `ClassSession.batchId`; removes `CourseTeacher`, `CourseEnrollment`, and `courseId` from slots/sessions.

- [ ] **Step 1: Update `prisma/schema.prisma`**

On `User`, replace `taughtCourses CourseTeacher[]` with `taughtBatches BatchTeacher[]`.

On `Course`, remove `teachers`, `enrollments`, `sessions`, `scheduleSlots`. Add `batches CourseBatch[]`. Keep `applications` and all policy/schedule-bound fields on `Course` (`startDate`/`endDate` stay on Course per prior design — slots move).

Add:

```prisma
model CourseBatch {
  id        String   @id @default(cuid())
  courseId  String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course        Course               @relation(fields: [courseId], references: [id], onDelete: Cascade)
  teachers      BatchTeacher[]
  enrollments   BatchEnrollment[]
  scheduleSlots CourseScheduleSlot[]
  sessions      ClassSession[]

  @@unique([courseId, name])
  @@map("course_batches")
}

model BatchTeacher {
  batchId   String
  teacherId String

  batch   CourseBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  teacher User        @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  @@id([batchId, teacherId])
  @@map("batch_teachers")
}

model BatchEnrollment {
  batchId   String
  studentId String
  createdAt DateTime @default(now())

  batch   CourseBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  student Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@id([batchId, studentId])
  @@map("batch_enrollments")
}
```

Update `Student`: `enrollments BatchEnrollment[]`.

Update `CourseScheduleSlot`: `courseId` → `batchId`, relation to `CourseBatch`, unique `[batchId, weekday, startMinute]`.

Update `ClassSession`: `courseId` → `batchId`, relation to `CourseBatch`.

Delete models `CourseTeacher` and `CourseEnrollment`.

- [ ] **Step 2: Create the migration with data backfill**

```bash
npx prisma migrate dev --name course_batches --create-only
```

Edit the generated SQL so that **before** dropping old FKs/tables it:

1. `CREATE TABLE course_batches` (+ unique on `(courseId, name)`).
2. `INSERT INTO course_batches (id, "courseId", name, "isActive", "createdAt", "updatedAt") SELECT …` one row per course with `name = 'Default'` (use `cuid`-like ids: `md5(random()::text || id)` or Prisma’s approach — prefer generating ids in a DO block with `replace(gen_random_uuid()::text, '-', '')` prefixed, or use `cuid` from a known extension; simplest portable approach: `('cbat_' || c.id)` truncated/padded only if needed — **use** `'cb_' || substr(md5(c.id), 1, 22)` for stable ids).
3. `CREATE TABLE batch_teachers` and `INSERT … SELECT b.id, ct."teacherId" FROM course_teachers ct JOIN course_batches b ON b."courseId" = ct."courseId" AND b.name = 'Default'`.
4. Same pattern for `batch_enrollments` from `course_enrollments`.
5. Add `batchId` to `course_schedule_slots` and `class_sessions`, backfill from Default batch, drop `courseId`, add FKs/uniques.
6. Drop `course_teachers` and `course_enrollments`.

Then:

```bash
npx prisma migrate dev
npx prisma generate
```

Expected: migrate applies cleanly on the dev DB; `npx prisma validate` exits 0.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat: add CourseBatch and migrate teachers/enrollments/sessions

Move teaching ownership onto batches so a course can have morning and
evening groups without sharing one roster.
EOF
)"
```

---

### Task 2: Enrollment helper (one batch per course)

**Files:**
- Create: `src/lib/enrollment.ts`
- Create: `src/lib/enrollment.test.ts`
- Create: `src/lib/batches.ts`

**Interfaces:**
- Consumes: Prisma `CourseBatch`, `BatchEnrollment`.
- Produces:
  - `DEFAULT_BATCH_NAME = "Default"`
  - `enrollStudentInBatch(studentId: string, batchId: string): Promise<void>`
  - `unenrollStudentFromBatch(studentId: string, batchId: string): Promise<void>`
  - `resolveTeacherBatchForCourse(teacherId: string, courseId: string): Promise<string | null>` — batch id the teacher is assigned to on that course (if several, the first by `createdAt`; Part 2 removes ambiguity via batch URLs).

- [ ] **Step 1: Write failing tests**

Create `src/lib/enrollment.test.ts`. Use Vitest. **Do not hit the real DB** — test a small exported pure planner if easier; preferred approach for this codebase: integration-style with Prisma against the test DB is heavy. Instead export the transaction steps behind functions and test the **invariant helper**:

```ts
import { describe, it, expect } from "vitest";
import { otherBatchEnrollmentWhere } from "@/lib/enrollment";

describe("otherBatchEnrollmentWhere", () => {
  it("targets the same student on sibling batches of the course", () => {
    expect(
      otherBatchEnrollmentWhere({
        studentId: "stu_1",
        courseId: "crs_1",
        exceptBatchId: "bat_morning",
      }),
    ).toEqual({
      studentId: "stu_1",
      batchId: { not: "bat_morning" },
      batch: { courseId: "crs_1" },
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- src/lib/enrollment.test.ts
```

Expected: FAIL — module or export missing.

- [ ] **Step 3: Implement**

Create `src/lib/batches.ts`:

```ts
export const DEFAULT_BATCH_NAME = "Default";
```

Create `src/lib/enrollment.ts`:

```ts
import { prisma } from "@/lib/prisma";

export function otherBatchEnrollmentWhere(args: {
  studentId: string;
  courseId: string;
  exceptBatchId: string;
}) {
  return {
    studentId: args.studentId,
    batchId: { not: args.exceptBatchId },
    batch: { courseId: args.courseId },
  };
}

export async function enrollStudentInBatch(studentId: string, batchId: string) {
  const batch = await prisma.courseBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { id: true, courseId: true },
  });

  await prisma.$transaction([
    prisma.batchEnrollment.deleteMany({
      where: otherBatchEnrollmentWhere({
        studentId,
        courseId: batch.courseId,
        exceptBatchId: batch.id,
      }),
    }),
    prisma.batchEnrollment.create({ data: { studentId, batchId: batch.id } }),
  ]);
}

export async function unenrollStudentFromBatch(studentId: string, batchId: string) {
  await prisma.batchEnrollment.deleteMany({ where: { studentId, batchId } });
}

export async function resolveTeacherBatchForCourse(teacherId: string, courseId: string) {
  const row = await prisma.batchTeacher.findFirst({
    where: { teacherId, batch: { courseId, isActive: true } },
    orderBy: { batch: { createdAt: "asc" } },
    select: { batchId: true },
  });
  return row?.batchId ?? null;
}
```

Note: `create` after `deleteMany` can still throw on unique `(batchId, studentId)` if already enrolled in that batch — callers should treat unique errors as “already enrolled” success or map to flash messages.

Handle already-in-target-batch: use `create` in try/catch or check first. Prefer:

```ts
await prisma.$transaction(async (tx) => {
  await tx.batchEnrollment.deleteMany({
    where: otherBatchEnrollmentWhere({ studentId, courseId: batch.courseId, exceptBatchId: batch.id }),
  });
  await tx.batchEnrollment.upsert({
    where: { batchId_studentId: { batchId: batch.id, studentId } },
    create: { batchId: batch.id, studentId },
    update: {},
  });
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- src/lib/enrollment.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrollment.ts src/lib/enrollment.test.ts src/lib/batches.ts
git commit -m "$(cat <<'EOF'
feat: add batch enrollment helpers

Enforce one batch per student per course when moving enrollments.
EOF
)"
```

---

### Task 3: Batch-scoped RBAC

**Files:**
- Modify: `src/lib/rbac.ts`
- Modify: `src/lib/permissions.ts` (update descriptions only)

**Interfaces:**
- Consumes: `BatchTeacher`, `PERMISSIONS`.
- Produces:
  - `canManageBatch(session, batchId): Promise<boolean>`
  - `requireBatchAccess(batchId): Promise<Session>`
  - `canConfigureBatch(session, batchId): Promise<boolean>`
  - `requireBatchConfigure(batchId): Promise<Session>`
  - Keep `canManageCourse` / `canConfigureCourse` as wrappers: true if admin **or** any `BatchTeacher` on a batch of that course (so Part 1 teacher course URLs still work).

- [ ] **Step 1: Update permission copy**

In `PERMISSION_DEFINITIONS`:

- `courses.manage`: `"Create and archive courses; manage batches, batch teachers, and batch rosters"`
- `students.manage`: `"Add students and manage course → batch enrollment"`
- `courses.configure`: `"Configure schedule, roster, and attendance policy for an assigned batch"`

- [ ] **Step 2: Implement batch guards in `src/lib/rbac.ts`**

```ts
export async function canManageBatch(session: Session, batchId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  const assignment = await prisma.batchTeacher.findUnique({
    where: { batchId_teacherId: { batchId, teacherId: session.user.id } },
  });
  return Boolean(assignment);
}

export async function requireBatchAccess(batchId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  if (!(await canManageBatch(session, batchId))) redirect("/teacher");
  return session;
}

export async function canConfigureBatch(session: Session, batchId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) return false;
  const assignment = await prisma.batchTeacher.findUnique({
    where: { batchId_teacherId: { batchId, teacherId: session.user.id } },
  });
  return Boolean(assignment);
}

export async function requireBatchConfigure(batchId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  if (!(await canConfigureBatch(session, batchId))) {
    redirect(`/teacher`); // Part 2: redirect to batch sessions URL
  }
  return session;
}
```

Rewrite `canManageCourse` / `canConfigureCourse` to use `batchTeacher` + `batch: { courseId }` instead of `courseTeacher`.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: errors only in call sites still using old models (fixed in Task 4). If `rbac.ts` alone typechecks within the project, proceed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rbac.ts src/lib/permissions.ts
git commit -m "$(cat <<'EOF'
feat: scope course access checks to batch teachers

Admins keep full access; teachers match BatchTeacher rows.
EOF
)"
```

---

### Task 4: Rewire existing app code to batches

Make the app compile and run against the new schema **without** the new Admin multi-batch UI yet. Create course → also create `Default` batch; assign teachers/enrollments on that batch.

**Files:**
- Modify: `src/app/admin/courses/actions.ts`
- Modify: `src/app/admin/courses/page.tsx` (temporary: still list teachers via batches)
- Modify: `src/app/admin/students/actions.ts`
- Modify: `src/app/admin/students/page.tsx`
- Modify: `src/app/teacher/page.tsx`
- Modify: `src/app/teacher/courses/[courseId]/layout.tsx`
- Modify: `src/app/teacher/courses/[courseId]/page.tsx`
- Modify: `src/app/teacher/courses/[courseId]/actions.ts`
- Modify: `src/app/teacher/courses/[courseId]/roster/page.tsx`
- Modify: `src/app/teacher/courses/[courseId]/roster/actions.ts`
- Modify: `src/app/teacher/courses/[courseId]/settings/page.tsx`
- Modify: `src/app/teacher/courses/[courseId]/settings/actions.ts`
- Modify: `src/app/teacher/sessions/[sessionId]/page.tsx`
- Modify: `src/app/teacher/sessions/[sessionId]/actions.ts`
- Modify: `src/app/teacher/students/page.tsx`
- Modify: `e2e/db.ts`

**Interfaces:**
- Consumes: `enrollStudentInBatch`, `DEFAULT_BATCH_NAME`, `resolveTeacherBatchForCourse`, batch RBAC.
- Produces: working admin/teacher flows on Default batches.

- [ ] **Step 1: Update `e2e/db.ts` fixtures**

```ts
import { DEFAULT_BATCH_NAME } from "../src/lib/batches";

export async function createCourse(name: string, code: string, teacherId?: string) {
  return prisma.course.create({
    data: {
      name,
      code,
      batches: {
        create: {
          name: DEFAULT_BATCH_NAME,
          teachers: teacherId ? { create: [{ teacherId }] } : undefined,
        },
      },
    },
    include: { batches: true },
  });
}

export async function createStudent(name: string, rollNumber: string, batchId?: string) {
  return prisma.student.create({
    data: {
      name,
      rollNumber,
      enrollments: batchId ? { create: [{ batchId }] } : undefined,
    },
  });
}

export async function createSession(batchId: string, createdById: string, date = new Date()) {
  return prisma.classSession.create({ data: { batchId, date, createdById } });
}
```

Update every e2e spec that passed `courseId` into `createStudent` / `createSession` to use the Default batch id from `createCourse` (`course.batches[0].id`).

- [ ] **Step 2: `createCourse` admin action**

On create, nest `batches: { create: { name: DEFAULT_BATCH_NAME, teachers: { create: teacherIds.map(...) } } } }`. Remove direct `teachers: { create... }` on course.

Keep teacher checkboxes on the create form for Part 1 Task 4 only — Task 5 removes them from the list UX. (Alternatively remove now and assign teachers only on batch page after Task 6 — **prefer remove teacher checkboxes in Task 5** and in Task 4 create course with empty Default batch.)

**Task 4 decision:** `createCourse` creates Default batch with **no** teachers; `updateCourseTeachers` is deleted; temporary admin list shows teacher names from `batches.flatMap(b => b.teachers)` read-only until Task 5–6.

- [ ] **Step 3: Students admin**

`createStudent` / `updateStudentEnrollments`: form still posts `courseIds` for now → for each courseId, enroll in that course’s batch named `Default` via `enrollStudentInBatch`. If Default missing, create it.

`approveApplication`: if `desiredCourseId`, enroll into that course’s Default batch (create Default if missing). No batch picker.

- [ ] **Step 4: Teacher pages**

For each course-scoped action/page:

1. Resolve `batchId` with `resolveTeacherBatchForCourse(session.user.id, courseId)`.
2. If null and user has `COURSES_MANAGE`, use the course’s Default batch (or first active batch).
3. If still null, treat as view-only / redirect as today’s unassigned behavior.
4. Query enrollments/sessions/slots via `batchId`.
5. Roster actions call `enrollStudentInBatch` / `unenrollStudentFromBatch` and `requireBatchConfigure(batchId)` (resolve batch first).
6. Session create uses `batchId`.
7. Layout enrollment count = sum of enrollments across batches **or** for assigned batch only when teacher is assigned — use assigned batch’s count when resolved, else total.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test
```

Expected: typecheck clean; unit tests pass.

```bash
npm run test:e2e -- e2e/admin-courses.spec.ts e2e/auth.spec.ts
```

Fix any fixture breakages from Step 1.

- [ ] **Step 6: Commit**

```bash
git add src e2e prisma
git commit -m "$(cat <<'EOF'
refactor: point app reads/writes at CourseBatch

Keep Default-batch behaviour so existing flows work after the schema move.
EOF
)"
```

---

### Task 5: Admin course list + course detail shell

**Files:**
- Modify: `src/app/admin/courses/page.tsx`
- Modify: `src/app/admin/courses/actions.ts`
- Create: `src/app/admin/courses/[courseId]/layout.tsx`
- Create: `src/app/admin/courses/[courseId]/page.tsx` (Batches tab)
- Create: `src/app/admin/courses/[courseId]/details/page.tsx`
- Create: `src/app/admin/courses/[courseId]/policy/page.tsx`
- Create: `src/app/admin/courses/[courseId]/actions.ts`
- Create: `src/components/admin-course-tabs.tsx`

**Interfaces:**
- Consumes: `courses.manage`, `DEFAULT_BATCH_NAME`.
- Produces: list without inline teacher editors; detail routes with tabs Batches | Details | Policy.

- [ ] **Step 1: Client tab strip**

Create `src/components/admin-course-tabs.tsx` mirroring `CourseTabs` but base `/admin/courses/${courseId}` and tabs:

- `""` → Batches  
- `"details"` → Details  
- `"policy"` → Policy  

- [ ] **Step 2: Course layout**

`layout.tsx`: `requirePermission(COURSES_MANAGE)`, load course by id, breadcrumb `← Courses`, title, `<AdminCourseTabs />`, children. `params: Promise<{ courseId: string }>`.

- [ ] **Step 3: Batches tab (`page.tsx`)**

List batches with name, teacher names, enrollment count, link to `/admin/courses/[courseId]/batches/[batchId]`. Form “Add batch” → `createBatch` action (name required) → redirect to new batch detail with success flash.

- [ ] **Step 4: Details + Policy tabs**

Details: edit name, code, description; archive/restore (move `toggleCourseActive` here or keep on list). Policy: same fields as teacher settings policy (`defaultStatus`, min %, late/excused flags, lock days) — server action updates `Course` only.

- [ ] **Step 5: Slim courses index**

Remove teacher checkbox columns. Show batch count + student count (sum enrollments). Row links to `/admin/courses/[id]`. Create form: name, code, description only; always creates Default batch.

- [ ] **Step 6: E2E smoke**

Update `e2e/admin-courses.spec.ts`: create course → expect success → open course → see Default batch → add “Morning” batch.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/courses src/components/admin-course-tabs.tsx e2e/admin-courses.spec.ts
git commit -m "$(cat <<'EOF'
feat: admin course detail with batches tab

List courses simply; manage batches and policy on the course page.
EOF
)"
```

---

### Task 6: Admin batch detail (Overview / Teachers / Roster)

**Files:**
- Create: `src/app/admin/courses/[courseId]/batches/[batchId]/layout.tsx`
- Create: `src/app/admin/courses/[courseId]/batches/[batchId]/page.tsx` (Overview)
- Create: `src/app/admin/courses/[courseId]/batches/[batchId]/teachers/page.tsx`
- Create: `src/app/admin/courses/[courseId]/batches/[batchId]/roster/page.tsx`
- Create: `src/app/admin/courses/[courseId]/batches/[batchId]/actions.ts`
- Create: `src/components/admin-batch-tabs.tsx`

**Interfaces:**
- Consumes: `enrollStudentInBatch`, `unenrollStudentFromBatch`, `courses.manage`.
- Produces: full admin batch management per spec.

- [ ] **Step 1: Layout + tabs**

Tabs: Overview (`""`), Teachers (`teachers`), Roster (`roster`). Verify `batch.courseId === courseId` else `notFound()`.

- [ ] **Step 2: Overview**

Edit batch `name` (unique per course — catch P2002), toggle `isActive`. Soft-archive only.

- [ ] **Step 3: Teachers**

Checkbox list of active users (same source as today’s admin courses teacher list). `updateBatchTeachers` replaces `BatchTeacher` rows for this batch in a transaction.

- [ ] **Step 4: Roster**

Search/add pattern like teacher roster: enroll via `enrollStudentInBatch` (moves student off sibling batches). Remove via `unenrollStudentFromBatch`. Flash on unique/FK errors.

- [ ] **Step 5: E2E**

Extend admin courses e2e or add `e2e/admin-batches.spec.ts`: Morning + Evening, different teachers, enroll student in Morning only; assert Evening roster lacks that student (via UI or prisma assert in test).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/courses src/components/admin-batch-tabs.tsx e2e
git commit -m "$(cat <<'EOF'
feat: admin batch overview, teachers, and roster

Assign teachers and place students per batch from the course tree.
EOF
)"
```

---

### Task 7: Admin students — course → batch enrollment

**Files:**
- Modify: `src/app/admin/students/page.tsx`
- Modify: `src/app/admin/students/actions.ts`
- Modify: `e2e/admin-students.spec.ts`

**Interfaces:**
- Consumes: `enrollStudentInBatch`, list of courses with batches.
- Produces: enrollment UI selecting a batch per course (or “not enrolled”).

- [ ] **Step 1: UI**

Replace course checkboxes with, per active course, a `<select name={`batch-${course.id}`}>` options: `""` (Not enrolled), then each active batch. On edit row, `defaultValue` = student’s current batch for that course if any.

- [ ] **Step 2: Actions**

`createStudent` / `updateStudentEnrollments`: read one selected batch id per course from form; for each selection call `enrollStudentInBatch`; for courses with empty selection, `deleteMany` enrollments on batches of that course for the student.

- [ ] **Step 3: E2E**

Update `e2e/admin-students.spec.ts` for the select-based UI.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/students e2e/admin-students.spec.ts
git commit -m "$(cat <<'EOF'
feat: enroll students into a course batch from admin

Replace course checkboxes with per-course batch selectors.
EOF
)"
```

---

### Task 8: Part 1 verification gate

- [ ] **Step 1: Full unit + targeted e2e**

```bash
npm test
npx tsc --noEmit
npm run test:e2e -- e2e/admin-courses.spec.ts e2e/admin-students.spec.ts e2e/admin-batches.spec.ts
```

Expected: all pass. If `admin-batches.spec.ts` was folded into admin-courses, run that file instead.

- [ ] **Step 2: Manual checklist** (record in commit message body if useful)

1. Create course → Default batch exists.  
2. Add Morning / Evening → assign different teachers.  
3. Enroll student in Morning via batch roster and via Students page.  
4. Teacher assigned only to Morning still opens `/teacher/courses/[id]` and sees only Morning roster (via resolver).

- [ ] **Step 3: Commit only if fixes were needed; otherwise done**

---

## Plan 2 preview (do not implement here)

- Move teacher workspace to `/teacher/batches/[batchId]/…` (`BatchTabs`, layout shows `Course · Batch`).
- Teacher home lists assigned batches.
- Redirect legacy `/teacher/courses/[courseId]` to the resolved batch when unambiguous.
- E2E: morning teacher marks attendance; evening teacher cannot see morning student.
- Retire `resolveTeacherBatchForCourse` ambiguity as the primary navigation path.

## Self-review (author)

| Spec item | Task |
|---|---|
| CourseBatch + BatchTeacher + BatchEnrollment | 1 |
| Slots/sessions on batch | 1 |
| Migration Default batch | 1 |
| One batch per course enrollment | 2, 6, 7 |
| Permissions reuse / descriptions | 3 |
| Admin list → detail → batch | 5, 6 |
| Admin students both places | 6, 7 |
| Auto Default on create | 4, 5 |
| Approve without batch picker | 4 |
| Teacher batch URLs | Plan 2 |
| Teacher isolation e2e | Plan 2 |
