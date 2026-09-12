# Teacher Course Configuration — Part 1: Permission, Settings, Roster

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a teacher a tabbed course workspace where they can edit course details, set an attendance policy, and manage their own roster — scoped to courses they are assigned to.

**Architecture:** A new `courses.configure` permission, effective only on assigned courses, gates a new tabbed layout under `/teacher/courses/[courseId]`. The layout fetches the course once and renders a tab strip; each tab is a small focused page with colocated server actions. Attendance percentage and at-risk logic live in pure functions in `src/lib/attendance.ts`, unit-tested with Vitest rather than through a browser.

**Tech Stack:** Next.js 16.3.1 (App Router, server actions), Prisma 6.19.3 + Postgres 16, Auth.js 5 beta, Zod 4.4.3, Tailwind 4, Playwright 1.62 (e2e), Vitest (new, unit).

**Spec:** `docs/superpowers/specs/2026-09-12-teacher-course-attendance-design.md`

**Scope:** This is plan 1 of 3 against that spec. Plan 2 covers the schedule engine and session generation. Plan 3 covers the attendance UX (today-first home, exception marking, grid view, student history). This plan deliberately lands the policy *fields* and one consumer (`defaultStatus`); the remaining policy consumers arrive in plan 3.

## Global Constraints

- **This directory is not a git repository.** `git rev-parse` fails. Before Task 1, either run `git init && git add -A && git commit -m "chore: initial commit"`, or strip the commit step from each task. Do not skip this decision silently — every task below ends in a commit.
- Commits authored by an agent end with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- The company name is written **Mal**, sentence case — never `MAL`.
- `AGENTS.md` applies: this is Next.js 16, not the Next.js in your training data. Read the relevant guide under `node_modules/next/dist/docs/` before writing routing, layout, or server-action code. `params` is a `Promise` and must be awaited.
- Tailwind uses the custom theme tokens in `src/app/globals.css`: `ink`, `accent`, `accent-dark`, `canvas`, `card`, `muted`, `hairline`, `input`. Use them — no raw hex, no default Tailwind greys.
- Server actions report results by redirecting through `flashUrl(path, kind, message)` from `src/lib/flash.ts`, read by `<FlashBanner />`. Follow the existing pattern in `src/app/admin/courses/actions.ts`.
- Playwright stays at `workers: 1`. Every e2e fixture uses `unique()` from `e2e/helpers.ts` for any unique column so repeated runs never collide.
- Every server action begins with a permission guard. A hidden tab or a disabled button is never access control.

---

### Task 1: Vitest, the `courses.configure` permission, and the schema migration

Foundation for everything else: a unit-test runner, the permission the whole plan is gated on, and every column later tasks write to.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `src/lib/permissions.ts`
- Create: `src/lib/permissions.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: `PERMISSIONS.COURSES_CONFIGURE` (value `"courses.configure"`); Prisma models `Course.startDate/endDate/defaultStatus/minAttendancePercent/lateCountsAsAttended/excusedCountsAsAttended/lockAfterDays`, `CourseScheduleSlot`, `ClassSession.startMinute/endMinute/slotId`; npm scripts `test` and `test:watch`.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Playwright's `testDir` is already `./e2e`, so scoping Vitest to `src/**/*.test.ts` keeps the two runners' globals from colliding.

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 3: Add the npm scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Both cases guard a real bug class. A permission key added to `PERMISSIONS` but missing from `PERMISSION_DEFINITIONS` never gets seeded into the database, so no role can ever hold it — the feature silently does nothing. A key defined but not granted to `Teacher` means teachers see no configuration tabs.

Create `src/lib/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PERMISSIONS, PERMISSION_DEFINITIONS, DEFAULT_ROLES } from "@/lib/permissions";

describe("permission registry", () => {
  it("defines every PERMISSIONS value in PERMISSION_DEFINITIONS", () => {
    const defined = PERMISSION_DEFINITIONS.map((p) => p.key);
    for (const key of Object.values(PERMISSIONS)) {
      expect(defined).toContain(key);
    }
  });

  it("grants courses.configure to the Teacher role by default", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).toContain(PERMISSIONS.COURSES_CONFIGURE);
  });

  it("keeps courses.manage out of the Teacher role", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).not.toContain(PERMISSIONS.COURSES_MANAGE);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Property 'COURSES_CONFIGURE' does not exist` / the Teacher assertion fails.

- [ ] **Step 6: Add the permission**

In `src/lib/permissions.ts`, add to the `PERMISSIONS` object after `COURSES_MANAGE`:

```ts
COURSES_CONFIGURE: "courses.configure",
```

Add to `PERMISSION_DEFINITIONS`:

```ts
{
  key: PERMISSIONS.COURSES_CONFIGURE,
  description: "Configure schedule, roster, and attendance policy for an assigned course",
},
```

Add to the `Teacher` entry's `permissions` array in `DEFAULT_ROLES`:

```ts
permissions: [
  PERMISSIONS.COURSES_CONFIGURE,
  PERMISSIONS.SESSIONS_MANAGE,
  PERMISSIONS.ATTENDANCE_MARK,
  PERMISSIONS.ATTENDANCE_VIEW,
],
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 8: Add the schema fields**

In `prisma/schema.prisma`, extend `model Course` — keep all existing fields, add:

```prisma
  // Schedule. Null bounds mean the course is unscheduled: manual sessions
  // only, which is exactly the behaviour of every pre-existing row.
  startDate DateTime?
  endDate   DateTime?

  // Attendance policy.
  defaultStatus           AttendanceStatus @default(PRESENT)
  minAttendancePercent    Int?             // null = no at-risk flag
  lateCountsAsAttended    Boolean          @default(true)
  excusedCountsAsAttended Boolean          @default(true)
  lockAfterDays           Int?             // null = never locks

  scheduleSlots CourseScheduleSlot[]
```

Add the new model:

```prisma
model CourseScheduleSlot {
  id          String @id @default(cuid())
  courseId    String
  weekday     Int    // 0 = Sunday … 6 = Saturday
  startMinute Int    // wall-clock minutes from midnight, e.g. 1080 = 18:00
  endMinute   Int

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([courseId, weekday, startMinute])
  @@map("course_schedule_slots")
}
```

Extend `model ClassSession` — keep all existing fields, add:

```prisma
  startMinute Int?    // copied from the slot at generation time
  endMinute   Int?
  // Provenance, deliberately NOT a foreign key: a slot can be deleted while
  // its already-marked sessions must survive. Null = hand-created and never
  // auto-removed; set = generated and eligible for regeneration.
  slotId      String?
```

- [ ] **Step 9: Run the migration**

```bash
npx prisma migrate dev --name add_course_schedule_and_policy
```

Expected: migration applies, client regenerates. Every added column is nullable or has a default, so existing rows need no backfill.

- [ ] **Step 10: Re-seed so the new permission reaches the Teacher role**

```bash
npm run db:seed
```

Expected: `Seed complete.`

**Heads-up before you run this:** `prisma/seed.ts:25-27` deletes every `RolePermission` for each default role and recreates it from `DEFAULT_ROLES`. Any permission grant an admin customised through `/admin/roles` for `Admin` or `Teacher` is reset. That is pre-existing seed behaviour, not something this task introduces — but say so in the commit message so nobody is surprised on a shared database.

- [ ] **Step 11: Verify the whole thing still builds**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass, no type errors, no lint errors.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/permissions.ts src/lib/permissions.test.ts prisma/schema.prisma prisma/migrations
git commit -m "feat: add courses.configure permission, schedule/policy schema, and vitest

Re-running db:seed resets Admin/Teacher role permission grants to the
defaults in permissions.ts — pre-existing seed behaviour, noted here
because this change requires a reseed."
```

---

### Task 2: Course workspace shell, tabs, and the Settings details form

Turns the single course page into a tabbed workspace and lands the first configuration tab. The redirect test at the end is the one that proves tab visibility is not doing the access control.

**Files:**
- Modify: `src/lib/rbac.ts`
- Create: `src/components/course-tabs.tsx`
- Create: `src/app/teacher/courses/[courseId]/layout.tsx`
- Modify: `src/app/teacher/courses/[courseId]/page.tsx`
- Create: `src/app/teacher/courses/[courseId]/settings/page.tsx`
- Create: `src/app/teacher/courses/[courseId]/settings/actions.ts`
- Create: `e2e/teacher-course-settings.spec.ts`

**Interfaces:**
- Consumes: `PERMISSIONS.COURSES_CONFIGURE` from Task 1.
- Produces: `canConfigureCourse(session: Session, courseId: string): Promise<boolean>` and `requireCourseConfigure(courseId: string): Promise<Session>` in `src/lib/rbac.ts`; `<CourseTabs courseId={string} canConfigure={boolean} />`; server action `updateCourseDetails(courseId: string, formData: FormData)`.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/teacher-course-settings.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { login, unique, waitForFlashAfter } from "./helpers";
import { createTeacher, createCourse } from "./db";

test.describe("teacher: course settings", () => {
  test("shows configuration tabs only for assigned courses, and enforces it on the route", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Settings Teacher ${unique("t")}`,
      `${unique("settingsteacher")}@example.com`,
      password,
    );
    const mine = await createCourse(`Kirtan Standards ${unique("c")}`, unique("SET").toUpperCase(), teacher.id);
    const other = await createCourse(`Sanskrit Grammar ${unique("c")}`, unique("OTS").toUpperCase());

    await login(page, teacher.email, password);

    await page.goto(`/teacher/courses/${mine.id}`);
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.goto(`/teacher/courses/${other.id}`);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

    // A hidden tab is not access control — the route itself must refuse.
    await page.goto(`/teacher/courses/${other.id}/settings`);
    await expect(page).toHaveURL(`/teacher/courses/${other.id}`);
  });

  test("edits course details", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Detail Teacher ${unique("t")}`,
      `${unique("detailteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Old Name ${unique("c")}`, unique("DET").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);

    const newName = `New Name ${unique("c")}`;
    await page.fill('input[name="name"]', newName);
    await page.fill('textarea[name="description"]', "Revised outline");

    const kind = await waitForFlashAfter(page, () => page.click('button:has-text("Save details")'));
    expect(kind).toBe("success");
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/teacher-course-settings.spec.ts`
Expected: FAIL — no Settings link, and `/settings` 404s.

- [ ] **Step 3: Add the configure guards**

Append to `src/lib/rbac.ts`:

```ts
// Non-redirecting check: can this user configure (edit details, policy,
// roster, schedule for) a given course? Admins holding COURSES_MANAGE can
// configure any course; everyone else needs COURSES_CONFIGURE *and* an
// assignment to this specific course.
export async function canConfigureCourse(session: Session, courseId: string) {
  if (session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE)) return true;
  if (!session.user.permissions.includes(PERMISSIONS.COURSES_CONFIGURE)) return false;

  const assignment = await prisma.courseTeacher.findUnique({
    where: { courseId_teacherId: { courseId, teacherId: session.user.id } },
  });
  return Boolean(assignment);
}

// Server-action / page guard: redirects back to the course when the
// signed-in user may not configure it.
export async function requireCourseConfigure(courseId: string) {
  const session = await requireAnyPermission([
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);

  if (!(await canConfigureCourse(session, courseId))) redirect(`/teacher/courses/${courseId}`);

  return session;
}
```

- [ ] **Step 4: Create the tab strip**

Tabs are added to this list as later tasks land their pages — Roster in Task 6, Schedule in plan 2. Do not add a tab whose route does not exist yet.

Create `src/components/course-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [{ slug: "", label: "Sessions" }];
const CONFIG_TABS = [{ slug: "settings", label: "Settings" }];

export function CourseTabs({ courseId, canConfigure }: { courseId: string; canConfigure: boolean }) {
  const pathname = usePathname();
  const base = `/teacher/courses/${courseId}`;
  const tabs = canConfigure ? [...BASE_TABS, ...CONFIG_TABS] : BASE_TABS;

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.slug || "sessions"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-ink font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Create the course layout**

Create `src/app/teacher/courses/[courseId]/layout.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, canConfigureCourse, canManageCourse } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { CourseTabs } from "@/components/course-tabs";
import { FlashBanner } from "@/components/flash-banner";

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, code: true, _count: { select: { enrollments: true } } },
  });
  if (!course) notFound();

  const [canConfigure, canManage] = await Promise.all([
    canConfigureCourse(session, courseId),
    canManageCourse(session, courseId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/teacher" className="text-sm text-muted">
          &larr; Courses
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{course.name}</h1>
        <p className="text-sm text-muted">
          {course.code} &middot; {course._count.enrollments} enrolled student(s)
        </p>
        {!canManage && (
          <p className="mt-2 text-xs text-muted">
            View only &mdash; you&apos;re not assigned to teach this course.
          </p>
        )}
      </div>
      <CourseTabs courseId={courseId} canConfigure={canConfigure} />
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Strip the moved chrome out of the Sessions page**

In `src/app/teacher/courses/[courseId]/page.tsx`, the header block, the `<FlashBanner />`, and the "View only" notice now live in the layout — rendering them twice is the bug this step prevents.

Delete the `<FlashBanner />` element and the entire `<div>` holding the back-link, `<h1>`, code/enrolment line, and the `!canManage` notice. Remove the now-unused `Link` and `FlashBanner` imports. Keep the course description, the New-session form, and the sessions list. Narrow the query — `sessions` and `description` are all this page still needs:

```tsx
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      description: true,
      sessions: { orderBy: { date: "desc" }, include: { _count: { select: { records: true } } } },
    },
  });
  if (!course) notFound();
```

Wrap what remains in `<div className="flex flex-col gap-6">` and render the description first:

```tsx
      {course.description && <p className="text-sm text-ink">{course.description}</p>}
```

- [ ] **Step 7: Create the details server action**

Create `src/app/teacher/courses/[courseId]/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const detailsSchema = z.object({
  name: z.string().min(1, "Course name is required."),
  code: z.string().min(1, "Course code is required."),
  description: z.string().optional(),
});

export async function updateCourseDetails(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/settings`;

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await prisma.course.update({ where: { id: courseId }, data: parsed.data });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That course code is already in use."));
    }
    throw err;
  }

  revalidatePath(path);
  revalidatePath(`/teacher/courses/${courseId}`);
  redirect(flashUrl(path, "success", "Course details saved."));
}
```

- [ ] **Step 8: Create the Settings page**

Create `src/app/teacher/courses/[courseId]/settings/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { updateCourseDetails } from "./actions";

export default async function CourseSettingsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseConfigure(courseId);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true, code: true, description: true },
  });
  if (!course) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
      <form
        action={updateCourseDetails.bind(null, courseId)}
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-ink">
          Course name
          <input
            name="name"
            required
            defaultValue={course.name}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Course code
          <input
            name="code"
            required
            defaultValue={course.code}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={course.description ?? ""}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
          Save details
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx playwright test e2e/teacher-course-settings.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 10: Run the existing suite for regressions**

The Sessions page changed shape, so `e2e/teacher-courses.spec.ts` and `e2e/attendance.spec.ts` are the ones at risk.

Run: `npx playwright test && npm test && npx tsc --noEmit && npm run lint`
Expected: all green. If `teacher-courses.spec.ts` fails on the "View only" or course-name assertions, the text moved to the layout — the assertions still hold against the rendered page, so investigate a real regression rather than weakening the test.

- [ ] **Step 11: Commit**

```bash
git add src/lib/rbac.ts src/components/course-tabs.tsx "src/app/teacher/courses/[courseId]" e2e/teacher-course-settings.spec.ts
git commit -m "feat: tabbed course workspace with teacher-editable details"
```

---

### Task 3: Attendance policy form

Stores all four policy fields. Only `defaultStatus` gets a consumer in this plan (Task 4); the rest are consumed in plans 2 and 3.

**Files:**
- Modify: `src/lib/attendance.ts`
- Create: `src/lib/policy.ts`
- Create: `src/lib/policy.test.ts`
- Modify: `src/app/teacher/courses/[courseId]/settings/actions.ts`
- Modify: `src/app/teacher/courses/[courseId]/settings/page.tsx`
- Modify: `e2e/teacher-course-settings.spec.ts`

**Interfaces:**
- Consumes: `requireCourseConfigure`, `updateCourseDetails` from Task 2; `STATUS_OPTIONS`, `StatusValue` from `src/lib/attendance.ts`.
- Produces: `policySchema` (Zod) and `parsePolicyForm(formData: FormData)` in `src/lib/policy.ts`; server action `updateCoursePolicy(courseId: string, formData: FormData)`.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parsePolicyForm } from "@/lib/policy";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parsePolicyForm", () => {
  it("parses a full policy", () => {
    const result = parsePolicyForm(
      form({
        defaultStatus: "ABSENT",
        minAttendancePercent: "75",
        lateCountsAsAttended: "on",
        lockAfterDays: "7",
      }),
    );
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      defaultStatus: "ABSENT",
      minAttendancePercent: 75,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: false,
      lockAfterDays: 7,
    });
  });

  it("treats blank optional numbers as null, not zero", () => {
    const result = parsePolicyForm(
      form({ defaultStatus: "PRESENT", minAttendancePercent: "", lockAfterDays: "" }),
    );
    expect(result.success).toBe(true);
    expect(result.success && result.data.minAttendancePercent).toBeNull();
    expect(result.success && result.data.lockAfterDays).toBeNull();
  });

  it("rejects a percentage above 100", () => {
    const result = parsePolicyForm(form({ defaultStatus: "PRESENT", minAttendancePercent: "101" }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative lock window", () => {
    const result = parsePolicyForm(form({ defaultStatus: "PRESENT", lockAfterDays: "-1" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = parsePolicyForm(form({ defaultStatus: "TARDY" }));
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/policy.test.ts`
Expected: FAIL — cannot resolve `@/lib/policy`.

- [ ] **Step 3: Write the policy parser**

An unchecked checkbox is absent from `FormData` entirely, which is why the booleans read presence rather than a value. The `preprocess` step is what keeps an empty text input from coercing to `0` — a blank minimum must mean "no threshold", never "0%".

Create `src/lib/policy.ts`:

```ts
import { z } from "zod";
import { STATUS_OPTIONS, type StatusValue } from "@/lib/attendance";

const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value) as [StatusValue, ...StatusValue[]];

const emptyToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

export const policySchema = z.object({
  defaultStatus: z.enum(STATUS_VALUES),
  minAttendancePercent: z.preprocess(emptyToNull, z.number().int().min(0).max(100).nullable()),
  lateCountsAsAttended: z.boolean(),
  excusedCountsAsAttended: z.boolean(),
  lockAfterDays: z.preprocess(emptyToNull, z.number().int().min(0).nullable()),
});

export type PolicyInput = z.infer<typeof policySchema>;

export function parsePolicyForm(formData: FormData) {
  return policySchema.safeParse({
    defaultStatus: formData.get("defaultStatus"),
    minAttendancePercent: formData.get("minAttendancePercent"),
    // An unchecked checkbox is absent from FormData, so presence is the value.
    lateCountsAsAttended: formData.get("lateCountsAsAttended") !== null,
    excusedCountsAsAttended: formData.get("excusedCountsAsAttended") !== null,
    lockAfterDays: formData.get("lockAfterDays"),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/policy.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the policy server action**

Append to `src/app/teacher/courses/[courseId]/settings/actions.ts`, and add `import { parsePolicyForm } from "@/lib/policy";` at the top:

```ts
export async function updateCoursePolicy(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/settings`;

  const parsed = parsePolicyForm(formData);
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid policy"));
  }

  await prisma.course.update({ where: { id: courseId }, data: parsed.data });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Attendance policy saved."));
}
```

- [ ] **Step 6: Add the policy form to the Settings page**

In `src/app/teacher/courses/[courseId]/settings/page.tsx`, extend the `select` to include the policy columns:

```tsx
    select: {
      name: true,
      code: true,
      description: true,
      defaultStatus: true,
      minAttendancePercent: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      lockAfterDays: true,
    },
```

Add the imports:

```tsx
import { STATUS_OPTIONS } from "@/lib/attendance";
import { updateCourseDetails, updateCoursePolicy } from "./actions";
```

Wrap the existing `<section>` and the new one in a `<div className="flex flex-col gap-8">`, and add after the details section:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Attendance policy</h2>
        <form
          action={updateCoursePolicy.bind(null, courseId)}
          className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Default status on a fresh session
            <select
              name="defaultStatus"
              defaultValue={course.defaultStatus}
              className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              Every unmarked student starts here, so you only tap the exceptions.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-ink">
            Minimum attendance %
            <input
              type="number"
              name="minAttendancePercent"
              min={0}
              max={100}
              defaultValue={course.minAttendancePercent ?? ""}
              className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
            <span className="text-xs text-muted">Leave blank for no at-risk flag.</span>
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-ink">
            <legend className="text-muted">Counts as attended</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="lateCountsAsAttended" defaultChecked={course.lateCountsAsAttended} />
              Late
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="excusedCountsAsAttended"
                defaultChecked={course.excusedCountsAsAttended}
              />
              Excused
            </label>
            <span className="text-xs text-muted">Present always counts; absent never does.</span>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm text-ink">
            Lock attendance after (days)
            <input
              type="number"
              name="lockAfterDays"
              min={0}
              defaultValue={course.lockAfterDays ?? ""}
              className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
            <span className="text-xs text-muted">Leave blank to never lock.</span>
          </label>

          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Save policy
          </button>
        </form>
      </section>
```

- [ ] **Step 7: Add the e2e case**

Append inside the `test.describe` in `e2e/teacher-course-settings.spec.ts`:

```ts
  test("saves an attendance policy and rejects an out-of-range percentage", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Policy Teacher ${unique("t")}`,
      `${unique("policyteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Policy Course ${unique("c")}`, unique("POL").toUpperCase(), teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/settings`);

    await page.selectOption('select[name="defaultStatus"]', "ABSENT");
    await page.fill('input[name="minAttendancePercent"]', "75");
    await page.uncheck('input[name="excusedCountsAsAttended"]');
    await page.fill('input[name="lockAfterDays"]', "7");

    const ok = await waitForFlashAfter(page, () => page.click('button:has-text("Save policy")'));
    expect(ok).toBe("success");

    await page.reload();
    await expect(page.locator('select[name="defaultStatus"]')).toHaveValue("ABSENT");
    await expect(page.locator('input[name="minAttendancePercent"]')).toHaveValue("75");
    await expect(page.locator('input[name="excusedCountsAsAttended"]')).not.toBeChecked();

    // Bypass the browser's own number-input clamping to reach server validation.
    await page.locator('input[name="minAttendancePercent"]').evaluate((el) => el.removeAttribute("max"));
    await page.fill('input[name="minAttendancePercent"]', "101");
    const bad = await waitForFlashAfter(page, () => page.click('button:has-text("Save policy")'));
    expect(bad).toBe("error");
  });
```

- [ ] **Step 8: Run the tests**

Run: `npm test && npx playwright test e2e/teacher-course-settings.spec.ts`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/policy.ts src/lib/policy.test.ts "src/app/teacher/courses/[courseId]/settings" e2e/teacher-course-settings.spec.ts
git commit -m "feat: per-course attendance policy"
```

---

### Task 4: `defaultStatus` seeds the marking screen

Replaces the hardcoded `PRESENT` at `src/app/teacher/sessions/[sessionId]/page.tsx:34` so the first policy field does real work in this plan rather than sitting unused until plan 3.

**Files:**
- Modify: `src/app/teacher/sessions/[sessionId]/page.tsx`
- Create: `e2e/attendance-default-status.spec.ts`

**Interfaces:**
- Consumes: `Course.defaultStatus` from Task 1, saved via Task 3.
- Produces: nothing new. Behaviour change only.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/attendance-default-status.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createTeacher, createCourse, createStudent, createSession, prisma } from "./db";

test.describe("attendance: course default status", () => {
  test("seeds unmarked students from the course default instead of PRESENT", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Default Teacher ${unique("t")}`,
      `${unique("defaultteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Default Course ${unique("c")}`, unique("DEF").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: course.id }, data: { defaultStatus: "ABSENT" } });

    const student = await createStudent(`Default Student ${unique("s")}`, unique("RD").toUpperCase(), course.id);
    const classSession = await createSession(course.id, teacher.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/sessions/${classSession.id}`);

    await expect(page.locator(`input[name="status:${student.id}"][value="ABSENT"]`)).toBeChecked();
    await expect(page.locator(`input[name="status:${student.id}"][value="PRESENT"]`)).not.toBeChecked();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/attendance-default-status.spec.ts`
Expected: FAIL — the PRESENT radio is checked.

- [ ] **Step 3: Read the course default alongside the session**

In `src/app/teacher/sessions/[sessionId]/page.tsx`, the `course` include already exists — add `defaultStatus` to what it selects by extending the existing `include.course` to also carry the field. Change the `course` include so it reads:

```tsx
      course: {
        select: {
          id: true,
          name: true,
          defaultStatus: true,
          enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
        },
      },
```

- [ ] **Step 4: Use it when seeding rows**

Replace line 34's hardcoded fallback:

```tsx
    status: recordByStudent.get(student.id)?.status ?? classSession.course.defaultStatus,
```

Delete the now-redundant `as const` assertion that accompanied the literal.

- [ ] **Step 5: Run the tests**

Run: `npx playwright test e2e/attendance-default-status.spec.ts e2e/attendance.spec.ts && npx tsc --noEmit`
Expected: PASS. `attendance.spec.ts` must still pass unchanged — courses default to `PRESENT`, which is what it already asserts.

- [ ] **Step 6: Commit**

```bash
git add "src/app/teacher/sessions/[sessionId]/page.tsx" e2e/attendance-default-status.spec.ts
git commit -m "feat: seed unmarked attendance rows from the course default status"
```

---

### Task 5: Attendance percentage and at-risk helpers

Pure functions, no Prisma. This is the arithmetic the roster renders in Task 6 and the student history page renders in plan 3.

**Files:**
- Modify: `src/lib/attendance.ts`
- Create: `src/lib/attendance.test.ts`
- Modify: `src/lib/time.ts`
- Create: `src/lib/time.test.ts`

**Interfaces:**
- Consumes: `STATUS_OPTIONS`, `StatusValue` from `src/lib/attendance.ts`.
- Produces: type `AttendancePolicy = { minAttendancePercent: number | null; lateCountsAsAttended: boolean; excusedCountsAsAttended: boolean }`; type `StatusTally = Record<StatusValue, number>`; `emptyTally(): StatusTally`; `countsAsAttended(status: StatusValue, policy: AttendancePolicy): boolean`; `attendancePercent(tally: StatusTally, policy: AttendancePolicy): number | null`; `isAtRisk(percent: number | null, policy: AttendancePolicy): boolean`; `startOfTodayUtc(now?: Date): Date` in `src/lib/time.ts`.

**Note on the denominator.** The spec defines it as "past sessions with at least one attendance record". This implements the per-student refinement: a student's own record count. The two differ only for a student enrolled mid-term, and the per-student form is the correct one — it does not penalise someone for sessions held before they joined. Records exist for every enrolled student on any marked session, because `markAttendance` upserts across all enrollments.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/attendance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  attendancePercent,
  countsAsAttended,
  emptyTally,
  isAtRisk,
  type AttendancePolicy,
  type StatusTally,
} from "@/lib/attendance";

const strict: AttendancePolicy = {
  minAttendancePercent: 75,
  lateCountsAsAttended: false,
  excusedCountsAsAttended: false,
};
const lenient: AttendancePolicy = {
  minAttendancePercent: 75,
  lateCountsAsAttended: true,
  excusedCountsAsAttended: true,
};

function tally(partial: Partial<StatusTally>): StatusTally {
  return { ...emptyTally(), ...partial };
}

describe("countsAsAttended", () => {
  it("always counts PRESENT and never counts ABSENT, whatever the policy", () => {
    expect(countsAsAttended("PRESENT", strict)).toBe(true);
    expect(countsAsAttended("ABSENT", lenient)).toBe(false);
  });

  it("defers to the policy for LATE and EXCUSED", () => {
    expect(countsAsAttended("LATE", strict)).toBe(false);
    expect(countsAsAttended("LATE", lenient)).toBe(true);
    expect(countsAsAttended("EXCUSED", strict)).toBe(false);
    expect(countsAsAttended("EXCUSED", lenient)).toBe(true);
  });
});

describe("attendancePercent", () => {
  it("returns null when nothing has been marked, not 0", () => {
    expect(attendancePercent(emptyTally(), lenient)).toBeNull();
  });

  it("counts late and excused when the policy says so", () => {
    const t = tally({ PRESENT: 6, LATE: 1, EXCUSED: 1, ABSENT: 2 });
    expect(attendancePercent(t, lenient)).toBe(80);
    expect(attendancePercent(t, strict)).toBe(60);
  });

  it("rounds to the nearest whole percent", () => {
    expect(attendancePercent(tally({ PRESENT: 1, ABSENT: 2 }), lenient)).toBe(33);
  });
});

describe("isAtRisk", () => {
  it("is false for a student sitting exactly at the threshold", () => {
    expect(isAtRisk(75, lenient)).toBe(false);
  });

  it("is true strictly below the threshold", () => {
    expect(isAtRisk(74, lenient)).toBe(true);
  });

  it("is false when the course sets no threshold", () => {
    expect(isAtRisk(10, { ...lenient, minAttendancePercent: null })).toBe(false);
  });

  it("is false when there is no percentage to judge", () => {
    expect(isAtRisk(null, lenient)).toBe(false);
  });
});
```

Create `src/lib/time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { startOfTodayUtc } from "@/lib/time";

describe("startOfTodayUtc", () => {
  it("returns the local calendar date at UTC midnight", () => {
    const result = startOfTodayUtc(new Date(2026, 8, 12, 23, 30));
    expect(result.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("uses the local date even when UTC has already rolled over", () => {
    const result = startOfTodayUtc(new Date(2026, 0, 1, 0, 15));
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `attendancePercent`, `emptyTally`, `startOfTodayUtc` are not exported.

- [ ] **Step 3: Implement the attendance helpers**

Append to `src/lib/attendance.ts`:

```ts
export type AttendancePolicy = {
  minAttendancePercent: number | null;
  lateCountsAsAttended: boolean;
  excusedCountsAsAttended: boolean;
};

export type StatusTally = Record<StatusValue, number>;

export function emptyTally(): StatusTally {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
}

// PRESENT and ABSENT are fixed points: a policy that could exclude PRESENT
// or include ABSENT would only describe states that make no sense.
export function countsAsAttended(status: StatusValue, policy: AttendancePolicy): boolean {
  switch (status) {
    case "PRESENT":
      return true;
    case "ABSENT":
      return false;
    case "LATE":
      return policy.lateCountsAsAttended;
    case "EXCUSED":
      return policy.excusedCountsAsAttended;
  }
}

// Denominator is the student's own marked sessions, so a student who
// enrolled mid-term isn't penalised for classes held before they joined.
// Returns null rather than 0 when nothing is marked — "no data" and "never
// showed up" must not render the same.
export function attendancePercent(tally: StatusTally, policy: AttendancePolicy): number | null {
  let total = 0;
  let attended = 0;

  for (const { value } of STATUS_OPTIONS) {
    total += tally[value];
    if (countsAsAttended(value, policy)) attended += tally[value];
  }

  if (total === 0) return null;
  return Math.round((attended / total) * 100);
}

export function isAtRisk(percent: number | null, policy: AttendancePolicy): boolean {
  if (percent === null || policy.minAttendancePercent === null) return false;
  return percent < policy.minAttendancePercent;
}
```

- [ ] **Step 4: Implement the date helper**

Append to `src/lib/time.ts`:

```ts
// Session dates are stored at UTC midnight of the *local* calendar date —
// the app assumes one institution in one timezone (see the design doc).
// Reading local Y/M/D and rebuilding it in UTC is what keeps a session
// created at 23:30 local from landing on tomorrow's date.
export function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 permission tests, 5 policy tests, 9 attendance tests, 2 time tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attendance.ts src/lib/attendance.test.ts src/lib/time.ts src/lib/time.test.ts
git commit -m "feat: attendance percentage and at-risk helpers"
```

---

### Task 6: Roster tab — list view

The List half of the Roster tab. The Grid half is plan 3; this task adds the tab to the nav.

**Files:**
- Modify: `src/components/course-tabs.tsx`
- Create: `src/app/teacher/courses/[courseId]/roster/page.tsx`
- Create: `e2e/teacher-roster.spec.ts`

**Interfaces:**
- Consumes: `attendancePercent`, `isAtRisk`, `emptyTally`, `AttendancePolicy`, `StatusTally` from Task 5; `startOfTodayUtc` from Task 5; `canConfigureCourse` from Task 2.
- Produces: the `/teacher/courses/[courseId]/roster` route.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/teacher-roster.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createTeacher, createCourse, createStudent, createSession, prisma } from "./db";

test.describe("teacher: roster", () => {
  test("shows attendance percentage and flags a student below the threshold", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Roster Teacher ${unique("t")}`,
      `${unique("rosterteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Roster Course ${unique("c")}`, unique("ROS").toUpperCase(), teacher.id);
    await prisma.course.update({ where: { id: course.id }, data: { minAttendancePercent: 75 } });

    const good = await createStudent(`Good Student ${unique("s")}`, unique("RG").toUpperCase(), course.id);
    const poor = await createStudent(`Poor Student ${unique("s")}`, unique("RP").toUpperCase(), course.id);

    // Four past sessions: `good` attends all four, `poor` attends one.
    const day = 24 * 60 * 60 * 1000;
    for (let i = 1; i <= 4; i++) {
      const classSession = await createSession(course.id, teacher.id, new Date(Date.now() - i * day));
      await prisma.attendanceRecord.createMany({
        data: [
          { sessionId: classSession.id, studentId: good.id, status: "PRESENT", markedById: teacher.id },
          {
            sessionId: classSession.id,
            studentId: poor.id,
            status: i === 1 ? "PRESENT" : "ABSENT",
            markedById: teacher.id,
          },
        ],
      });
    }

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    const goodRow = page.locator("tr", { hasText: good.name });
    await expect(goodRow.getByText("100%")).toBeVisible();
    await expect(goodRow.getByText("At risk")).toHaveCount(0);

    const poorRow = page.locator("tr", { hasText: poor.name });
    await expect(poorRow.getByText("25%")).toBeVisible();
    await expect(poorRow.getByText("At risk")).toBeVisible();
  });

  test("shows no percentage for a student with nothing marked", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Blank Teacher ${unique("t")}`,
      `${unique("blankteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Blank Course ${unique("c")}`, unique("BLK").toUpperCase(), teacher.id);
    const student = await createStudent(`Blank Student ${unique("s")}`, unique("RB").toUpperCase(), course.id);

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    // Target the attendance cell by position: the Status cell renders an em
    // dash too, so getByText("—") would match twice and trip strict mode.
    const attendanceCell = page.locator("tr", { hasText: student.name }).locator("td").nth(2);
    await expect(attendanceCell).toHaveText("—");
    await expect(page.locator("tr", { hasText: student.name }).getByText("0%")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/teacher-roster.spec.ts`
Expected: FAIL — `/roster` 404s.

- [ ] **Step 3: Add the Roster tab**

In `src/components/course-tabs.tsx`, extend `BASE_TABS` — Roster is visible to any teacher who can see the course, configuration only gates who can *change* it:

```tsx
const BASE_TABS = [
  { slug: "", label: "Sessions" },
  { slug: "roster", label: "Roster" },
];
```

- [ ] **Step 4: Create the roster page**

One `groupBy` returns per-student, per-status counts for the whole course, so this page costs two queries whatever the class size.

Create `src/app/teacher/courses/[courseId]/roster/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { startOfTodayUtc } from "@/lib/time";
import {
  attendancePercent,
  emptyTally,
  isAtRisk,
  type AttendancePolicy,
  type StatusTally,
  type StatusValue,
} from "@/lib/attendance";

export default async function CourseRosterPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      minAttendancePercent: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
    },
  });
  if (!course) notFound();

  const policy: AttendancePolicy = {
    minAttendancePercent: course.minAttendancePercent,
    lateCountsAsAttended: course.lateCountsAsAttended,
    excusedCountsAsAttended: course.excusedCountsAsAttended,
  };

  // One grouped query for every student's per-status counts across the
  // course's past sessions.
  const grouped = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { session: { courseId, date: { lt: startOfTodayUtc() } } },
    _count: { _all: true },
  });

  const tallies = new Map<string, StatusTally>();
  for (const row of grouped) {
    const tally = tallies.get(row.studentId) ?? emptyTally();
    tally[row.status as StatusValue] = row._count._all;
    tallies.set(row.studentId, tally);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Roster &middot; {course.enrollments.length} student(s)
      </h2>
      {policy.minAttendancePercent !== null && (
        <p className="text-xs text-muted">
          Threshold {policy.minAttendancePercent}% &mdash; set in Settings &rsaquo; Attendance policy.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Attendance</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {course.enrollments.map(({ student }) => {
              const percent = attendancePercent(tallies.get(student.id) ?? emptyTally(), policy);
              const atRisk = isAtRisk(percent, policy);
              return (
                <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">{student.rollNumber}</td>
                  <td className="px-4 py-3">{student.name}</td>
                  <td className={`px-4 py-3 ${atRisk ? "font-semibold text-red-700" : ""}`}>
                    {percent === null ? "—" : `${percent}%`}
                  </td>
                  <td className="px-4 py-3">
                    {atRisk ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        At risk
                      </span>
                    ) : (
                      <span className="text-xs text-muted">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {course.enrollments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-muted">
                  No students enrolled in this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test e2e/teacher-roster.spec.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/course-tabs.tsx "src/app/teacher/courses/[courseId]/roster" e2e/teacher-roster.spec.ts
git commit -m "feat: roster tab with attendance percentage and at-risk flag"
```

---

### Task 7: Roster enrolment

Lets a teacher add and remove students on their own course — the thing `/teacher/students` currently tells them to ask an admin for.

**Files:**
- Create: `src/app/teacher/courses/[courseId]/roster/actions.ts`
- Modify: `src/app/teacher/courses/[courseId]/roster/page.tsx`
- Modify: `src/app/teacher/students/page.tsx`
- Modify: `e2e/teacher-roster.spec.ts`

**Interfaces:**
- Consumes: `requireCourseConfigure` from Task 2; the roster page from Task 6.
- Produces: server actions `enrollStudent(courseId: string, formData: FormData)` and `unenrollStudent(courseId: string, formData: FormData)`.

- [ ] **Step 1: Write the failing e2e test**

Append inside the `test.describe` in `e2e/teacher-roster.spec.ts`:

```ts
  test("enrolls and unenrolls a student", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Enroll Teacher ${unique("t")}`,
      `${unique("enrollteacher")}@example.com`,
      password,
    );
    const course = await createCourse(`Enroll Course ${unique("c")}`, unique("ENR").toUpperCase(), teacher.id);
    const student = await createStudent(`Enroll Student ${unique("s")}`, unique("RE").toUpperCase());

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${course.id}/roster`);

    await expect(page.getByText("No students enrolled in this course yet.")).toBeVisible();

    await page.selectOption('select[name="studentId"]', student.id);
    const added = await waitForFlashAfter(page, () => page.click('button:has-text("Enroll")'));
    expect(added).toBe("success");
    await expect(page.locator("tr", { hasText: student.name })).toBeVisible();

    const removed = await waitForFlashAfter(page, () =>
      page.locator("tr", { hasText: student.name }).getByRole("button", { name: "Remove" }).click(),
    );
    expect(removed).toBe("success");
    await expect(page.locator("tr", { hasText: student.name })).toHaveCount(0);
  });

  test("does not offer enrolment to a teacher who is not assigned", async ({ page }) => {
    const password = "TeacherPass123!";
    const teacher = await createTeacher(
      `Outsider Teacher ${unique("t")}`,
      `${unique("outsiderteacher")}@example.com`,
      password,
    );
    const other = await createCourse(`Outsider Course ${unique("c")}`, unique("OUT").toUpperCase());

    await login(page, teacher.email, password);
    await page.goto(`/teacher/courses/${other.id}/roster`);

    await expect(page.locator('select[name="studentId"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });
```

Add `waitForFlashAfter` to the import from `./helpers` at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/teacher-roster.spec.ts`
Expected: FAIL — no enrolment control exists.

- [ ] **Step 3: Write the enrolment actions**

Create `src/app/teacher/courses/[courseId]/roster/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";

const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

export async function enrollStudent(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await prisma.courseEnrollment.create({
      data: { courseId, studentId: parsed.data.studentId },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That student is already enrolled."));
    }
    throw err;
  }

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollStudent(courseId: string, formData: FormData) {
  await requireCourseConfigure(courseId);
  const path = `/teacher/courses/${courseId}/roster`;

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  // Attendance records are left intact: removing someone from the roster
  // must not rewrite the history of sessions they actually attended.
  await prisma.courseEnrollment.delete({
    where: { courseId_studentId: { courseId, studentId: parsed.data.studentId } },
  });

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student removed from this course."));
}
```

- [ ] **Step 4: Add the controls to the roster page**

In `src/app/teacher/courses/[courseId]/roster/page.tsx`, add the imports:

```tsx
import { canConfigureCourse } from "@/lib/rbac";
import { enrollStudent, unenrollStudent } from "./actions";
```

Capture the session and the configure check — replace the bare `await requireAnyPermission([...])` with:

```tsx
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.ATTENDANCE_VIEW,
  ]);
  const canConfigure = await canConfigureCourse(session, courseId);
```

After the `grouped` query, fetch the students available to add (only when the control will render):

```tsx
  const enrolledIds = course.enrollments.map((e) => e.studentId);
  const available = canConfigure
    ? await prisma.student.findMany({
        where: { isActive: true, id: { notIn: enrolledIds } },
        orderBy: { rollNumber: "asc" },
      })
    : [];
```

Add the enrolment form directly after the threshold paragraph:

```tsx
      {canConfigure && (
        <form
          action={enrollStudent.bind(null, courseId)}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-card p-4"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Add a student
            <select
              name="studentId"
              required
              defaultValue=""
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Select a student…
              </option>
              {available.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.rollNumber} — {student.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Enroll
          </button>
        </form>
      )}
```

Add a trailing header cell to the `<thead>` row:

```tsx
              <th className="px-4 py-2" />
```

Add a matching cell as the last child of the student `<tr>`:

```tsx
                  <td className="px-4 py-3">
                    {canConfigure && (
                      <form action={unenrollStudent.bind(null, courseId)}>
                        <input type="hidden" name="studentId" value={student.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted underline hover:text-accent-dark"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
```

Bump the empty-state `colSpan` from `4` to `5`.

- [ ] **Step 5: Correct the stale copy on the students page**

`src/app/teacher/students/page.tsx` tells teachers to ask an admin, which is no longer true for their own courses. Replace that paragraph's text with:

```tsx
          All active students, across every course. Manage enrolment for a course you teach from its Roster
          tab; ask an admin to add a new student record.
        </p>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test e2e/teacher-roster.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Run the whole suite**

Run: `npm test && npx playwright test && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add "src/app/teacher/courses/[courseId]/roster" src/app/teacher/students/page.tsx e2e/teacher-roster.spec.ts
git commit -m "feat: teacher-managed course enrolment"
```

---

## Done when

- A teacher assigned to a course sees Sessions, Roster, and Settings tabs; an unassigned teacher sees Sessions and Roster only, and is redirected off `/settings`.
- Course details and all four attendance policy fields save and reload correctly, with out-of-range values rejected server-side.
- A fresh session seeds unmarked students from the course's `defaultStatus`.
- The roster shows per-student attendance percentage, flags students below the threshold, and shows `—` rather than `0%` when nothing is marked.
- A teacher can enrol and remove students on their own courses.
- `npm test`, `npx playwright test`, `npx tsc --noEmit`, and `npm run lint` are all green.

## Not in this plan

- Schedule tab, `CourseScheduleSlot` writes, session generation, the change summary — **plan 2**. The schema columns land here; nothing writes them yet.
- Today-first `/teacher` landing page, exception marking, roster Grid view, `/teacher/students/[studentId]` history, attendance locking — **plan 3**. `minAttendancePercent`, `lateCountsAsAttended`, and `excusedCountsAsAttended` gain their second consumer there; `lockAfterDays` gains its first.
