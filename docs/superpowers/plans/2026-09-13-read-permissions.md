# Assigned-Batch Read Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `courses.read`, `sessions.read`, and `students.read` so assigned-batch staff can view those resources without write UI.

**Architecture:** Pure helpers in `permissions.ts` treat manage/configure as the matching read. Shared `TEACHER_PORTAL_PERMISSIONS` opens `/teacher` and course/batch view guards. Session write UI keys off `sessions.manage`, not batch assignment. Admin org-wide lists stay `*.manage`.

**Tech Stack:** Next.js App Router, Auth.js JWT permissions, Prisma seed (no schema migration), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-read-permissions-design.md`

## Global Constraints

- Assigned-batch scope only; `courses.manage` remains the only `{ kind: "all" }` pass
- `*.manage` and `courses.configure` imply the matching `*.read` in helpers — do not require both checkboxes
- **New session**, change date/time, remove session: `sessions.manage` only
- Teacher portal is the view surface; `/admin` course/student lists stay manage-only
- No Viewer system role; no Prisma schema migration
- Theme tokens only (`ink`, `accent`, `canvas`, `card`, `muted`, `hairline`, `input`)
- After registry change, seed so `permissions` rows exist (`npx prisma db seed` locally; e2e prepare already seeds)

## File map

| File | Responsibility |
|---|---|
| `src/lib/permissions.ts` | New keys, descriptions, Teacher `students.read`, read helpers, `TEACHER_PORTAL_PERMISSIONS` |
| `src/lib/permissions.test.ts` | Registry + helper unit tests |
| `src/lib/course-workspace.ts` | `teacherCourseTabSlugs`, `firstTeacherCoursePath` |
| `src/lib/course-workspace.test.ts` | Tab/path unit tests |
| `src/lib/rbac.ts` | View guards accept `TEACHER_PORTAL_PERMISSIONS` |
| `src/app/page.tsx` | Home redirect includes new reads |
| `src/app/teacher/layout.tsx` | Portal gate + nav by read helper |
| `src/app/teacher/account/actions.ts` | Password action uses portal list |
| `src/app/teacher/students/page.tsx` | Require `hasStudentsRead` |
| `src/app/teacher/courses/[courseId]/layout.tsx` | Pass visible tab slugs |
| `src/components/course-tabs.tsx` | Filter tabs by slug list |
| `src/components/course-workspace/sessions.tsx` | Hide New session / actions without `sessions.manage` |
| `src/components/course-workspace/session-detail.tsx` | Attendance form: `attendance.mark` |
| `src/components/course-workspace/roster.tsx` | Redirect if no `students.read` |
| `src/components/course-workspace/uploads.tsx` | Redirect if no `courses.read` |
| `src/components/course-workspace/assignments.tsx` | Redirect if no `courses.read` |
| `e2e/db.ts` | `createStaffWithPermissions` fixture |
| `e2e/teacher-session-read.spec.ts` | Read role sees list, not New session |

---

### Task 1: Registry and read helpers

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/lib/permissions.test.ts`

**Produces:**
- `PERMISSIONS.COURSES_READ = "courses.read"`
- `PERMISSIONS.SESSIONS_READ = "sessions.read"`
- `PERMISSIONS.STUDENTS_READ = "students.read"`
- `hasCoursesRead(permissions: readonly string[]): boolean`
- `hasSessionsRead(permissions: readonly string[]): boolean`
- `hasSessionsManage(permissions: readonly string[]): boolean`
- `hasStudentsRead(permissions: readonly string[]): boolean`
- `hasAttendanceAccess(permissions: readonly string[]): boolean`
- `TEACHER_PORTAL_PERMISSIONS: PermissionKey[]`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/permissions.test.ts` (keep the existing three tests):

```ts
import {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLES,
  hasCoursesRead,
  hasSessionsRead,
  hasSessionsManage,
  hasStudentsRead,
  hasAttendanceAccess,
  TEACHER_PORTAL_PERMISSIONS,
} from "@/lib/permissions";

it("grants students.read to the Teacher role by default", () => {
  const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
  expect(teacher?.permissions).toContain(PERMISSIONS.STUDENTS_READ);
});

it("keeps students.manage out of the Teacher role", () => {
  const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
  expect(teacher?.permissions).not.toContain(PERMISSIONS.STUDENTS_MANAGE);
});

it("treats manage and configure as the matching read", () => {
  expect(hasCoursesRead([PERMISSIONS.COURSES_READ])).toBe(true);
  expect(hasCoursesRead([PERMISSIONS.COURSES_MANAGE])).toBe(true);
  expect(hasCoursesRead([PERMISSIONS.COURSES_CONFIGURE])).toBe(true);
  expect(hasCoursesRead([PERMISSIONS.SESSIONS_READ])).toBe(false);

  expect(hasSessionsRead([PERMISSIONS.SESSIONS_READ])).toBe(true);
  expect(hasSessionsRead([PERMISSIONS.SESSIONS_MANAGE])).toBe(true);
  expect(hasSessionsRead([PERMISSIONS.COURSES_READ])).toBe(false);
  expect(hasSessionsManage([PERMISSIONS.SESSIONS_MANAGE])).toBe(true);
  expect(hasSessionsManage([PERMISSIONS.SESSIONS_READ])).toBe(false);

  expect(hasStudentsRead([PERMISSIONS.STUDENTS_READ])).toBe(true);
  expect(hasStudentsRead([PERMISSIONS.STUDENTS_MANAGE])).toBe(true);
  expect(hasStudentsRead([PERMISSIONS.COURSES_READ])).toBe(false);

  expect(hasAttendanceAccess([PERMISSIONS.ATTENDANCE_VIEW])).toBe(true);
  expect(hasAttendanceAccess([PERMISSIONS.ATTENDANCE_MARK])).toBe(true);
  expect(hasAttendanceAccess([PERMISSIONS.SESSIONS_READ])).toBe(false);
});

it("lists teacher portal keys including the new reads", () => {
  expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.COURSES_READ);
  expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.SESSIONS_READ);
  expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.STUDENTS_READ);
  expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.SESSIONS_MANAGE);
  expect(TEACHER_PORTAL_PERMISSIONS).toContain(PERMISSIONS.ATTENDANCE_VIEW);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/permissions.test.ts`

Expected: FAIL — `STUDENTS_READ` / helpers not exported.

- [ ] **Step 3: Implement registry and helpers**

In `src/lib/permissions.ts`, add the three keys next to their manage siblings:

```ts
export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  COURSES_MANAGE: "courses.manage",
  COURSES_CONFIGURE: "courses.configure",
  COURSES_READ: "courses.read",
  STUDENTS_MANAGE: "students.manage",
  STUDENTS_READ: "students.read",
  SESSIONS_MANAGE: "sessions.manage",
  SESSIONS_READ: "sessions.read",
  ATTENDANCE_MARK: "attendance.mark",
  ATTENDANCE_VIEW: "attendance.view",
} as const;
```

Add definitions (wording exact):

```ts
{ key: PERMISSIONS.COURSES_READ, description: "View assigned courses and batch workspace" },
{ key: PERMISSIONS.STUDENTS_READ, description: "View students enrolled in assigned batches" },
{ key: PERMISSIONS.SESSIONS_READ, description: "View class sessions for assigned batches" },
```

Teacher `permissions` array: keep configure / sessions.manage / attendance, append `PERMISSIONS.STUDENTS_READ`.

Helpers + portal list at the bottom of the same file:

```ts
export function hasCoursesRead(permissions: readonly string[]) {
  return (
    permissions.includes(PERMISSIONS.COURSES_READ) ||
    permissions.includes(PERMISSIONS.COURSES_MANAGE) ||
    permissions.includes(PERMISSIONS.COURSES_CONFIGURE)
  );
}

export function hasSessionsRead(permissions: readonly string[]) {
  return permissions.includes(PERMISSIONS.SESSIONS_READ) || permissions.includes(PERMISSIONS.SESSIONS_MANAGE);
}

export function hasSessionsManage(permissions: readonly string[]) {
  return permissions.includes(PERMISSIONS.SESSIONS_MANAGE);
}

export function hasStudentsRead(permissions: readonly string[]) {
  return permissions.includes(PERMISSIONS.STUDENTS_READ) || permissions.includes(PERMISSIONS.STUDENTS_MANAGE);
}

export function hasAttendanceAccess(permissions: readonly string[]) {
  return permissions.includes(PERMISSIONS.ATTENDANCE_VIEW) || permissions.includes(PERMISSIONS.ATTENDANCE_MARK);
}

export const TEACHER_PORTAL_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.COURSES_READ,
  PERMISSIONS.COURSES_CONFIGURE,
  PERMISSIONS.COURSES_MANAGE,
  PERMISSIONS.SESSIONS_READ,
  PERMISSIONS.SESSIONS_MANAGE,
  PERMISSIONS.STUDENTS_READ,
  PERMISSIONS.STUDENTS_MANAGE,
  PERMISSIONS.ATTENDANCE_MARK,
  PERMISSIONS.ATTENDANCE_VIEW,
];
```

Admin still uses `Object.values(PERMISSIONS)` — new keys are included automatically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/permissions.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts src/lib/permissions.test.ts
git commit -m "$(cat <<'EOF'
feat(rbac): add assigned-batch read permissions
EOF
)"
```

---

### Task 2: Tab path helpers and RBAC guards

**Files:**
- Modify: `src/lib/course-workspace.ts`
- Modify: `src/lib/course-workspace.test.ts`
- Modify: `src/lib/rbac.ts`

**Consumes:** `hasCoursesRead`, `hasSessionsRead`, `hasStudentsRead`, `hasAttendanceAccess`, `TEACHER_PORTAL_PERMISSIONS`

**Produces:**
- `teacherCourseTabSlugs(permissions: readonly string[], canConfigure: boolean): string[]`
- `firstTeacherCoursePath(courseId: string, permissions: readonly string[]): string`
- `requireCourseAccess` / `requireBatchView` / `requireBatchAccess` accept `TEACHER_PORTAL_PERMISSIONS`

- [ ] **Step 1: Write the failing path/tab tests**

Append to `src/lib/course-workspace.test.ts` (create the file if missing):

```ts
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions";
import { firstTeacherCoursePath, teacherCourseTabSlugs } from "@/lib/course-workspace";

describe("teacher course tabs", () => {
  it("shows sessions only when sessions.read is implied", () => {
    expect(teacherCourseTabSlugs([PERMISSIONS.SESSIONS_READ], false)).toEqual([""]);
    expect(teacherCourseTabSlugs([PERMISSIONS.STUDENTS_READ], false)).toEqual(["roster"]);
  });

  it("shows schedule and settings only when configure is true", () => {
    expect(teacherCourseTabSlugs([PERMISSIONS.COURSES_CONFIGURE, PERMISSIONS.SESSIONS_MANAGE], true)).toEqual([
      "",
      "schedule",
      "uploads",
      "assignments",
      "settings",
    ]);
  });

  it("adds roster when students.read is present", () => {
    const slugs = teacherCourseTabSlugs(
      [PERMISSIONS.COURSES_CONFIGURE, PERMISSIONS.SESSIONS_MANAGE, PERMISSIONS.STUDENTS_READ],
      true,
    );
    expect(slugs).toContain("roster");
  });

  it("picks the first allowed course path", () => {
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.SESSIONS_READ])).toBe("/teacher/courses/c1");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.STUDENTS_READ])).toBe("/teacher/courses/c1/roster");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.ATTENDANCE_VIEW])).toBe("/teacher/courses/c1/attendance");
    expect(firstTeacherCoursePath("c1", [PERMISSIONS.COURSES_READ])).toBe("/teacher/courses/c1/uploads");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/course-workspace.test.ts`

Expected: FAIL — exports missing.

- [ ] **Step 3: Implement helpers**

In `src/lib/course-workspace.ts` import the permission helpers and add:

```ts
export function teacherCourseTabSlugs(permissions: readonly string[], canConfigure: boolean): string[] {
  const slugs: string[] = [];
  if (hasSessionsRead(permissions)) slugs.push("");
  if (canConfigure) slugs.push("schedule");
  if (hasStudentsRead(permissions)) slugs.push("roster");
  if (hasAttendanceAccess(permissions)) slugs.push("attendance");
  if (hasCoursesRead(permissions)) {
    slugs.push("uploads", "assignments");
  }
  if (canConfigure) slugs.push("settings");
  return slugs;
}

export function firstTeacherCoursePath(courseId: string, permissions: readonly string[]): string {
  const base = `/teacher/courses/${courseId}`;
  if (hasSessionsRead(permissions)) return base;
  if (hasStudentsRead(permissions)) return `${base}/roster`;
  if (hasAttendanceAccess(permissions)) return `${base}/attendance`;
  if (hasCoursesRead(permissions)) return `${base}/uploads`;
  return "/teacher";
}
```

- [ ] **Step 4: Point RBAC view guards at the portal list**

In `src/lib/rbac.ts` import `TEACHER_PORTAL_PERMISSIONS`. Replace the three-key arrays in `requireBatchAccess`, `requireBatchView`, and `requireCourseAccess` with `TEACHER_PORTAL_PERMISSIONS`.

Leave `requireBatchConfigure` / `requireCourseConfigure` unchanged.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run src/lib/permissions.test.ts src/lib/course-workspace.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/course-workspace.ts src/lib/course-workspace.test.ts src/lib/rbac.ts
git commit -m "$(cat <<'EOF'
feat(rbac): open teacher view guards to read keys
EOF
)"
```

---

### Task 3: Hide session writes and filter course tabs

**Files:**
- Modify: `src/components/course-workspace/sessions.tsx`
- Modify: `src/components/course-workspace/session-detail.tsx`
- Modify: `src/components/course-tabs.tsx`
- Modify: `src/app/teacher/courses/[courseId]/layout.tsx`
- Modify: `src/components/course-workspace/roster.tsx`
- Modify: `src/components/course-workspace/uploads.tsx`
- Modify: `src/components/course-workspace/assignments.tsx`
- Modify: `src/components/course-workspace/attendance.tsx` (redirect only if no attendance access)

**Consumes:** `hasSessionsManage`, `hasSessionsRead`, `hasStudentsRead`, `hasCoursesRead`, `hasAttendanceAccess`, `firstTeacherCoursePath`, `teacherCourseTabSlugs`

- [ ] **Step 1: Gate New session on `sessions.manage`**

In `CourseSessionsView`, keep `loadCourseWorkspace` and use `session` from it:

```ts
const { session, scope, canManage } = await loadCourseWorkspace(courseId, portal, selectedBatchId);
const perms = session.user.permissions;
if (portal === "teacher" && !hasSessionsRead(perms)) {
  redirect(firstTeacherCoursePath(courseId, perms));
}
const canWriteSessions = canManage && hasSessionsManage(perms);
```

Replace every `canManage` in this file that wraps **New session** or `SessionActionsMenu` with `canWriteSessions`.

Session title link: use `hasSessionsRead(perms)` (or always link on this page after the redirect). Do not use `canWriteSessions` for the link.

Import `redirect` from `next/navigation`, helpers from `@/lib/permissions` and `firstTeacherCoursePath` from `@/lib/course-workspace`.

- [ ] **Step 2: Gate attendance form on `attendance.mark`**

In `src/components/course-workspace/session-detail.tsx`:

```ts
const canMarkAttendance =
  canManage && session.user.permissions.includes(PERMISSIONS.ATTENDANCE_MARK);
```

Use `canMarkAttendance` for the `AttendanceForm` vs read-only table branch. Keep `canManageSession` for date/remove. Pass `canManage={canMarkAttendance}` into `SessionResources` only if uploads should stay assignment-based — **keep resource upload on `canManage`** (assignment). Spec does not add a files permission.

- [ ] **Step 3: Filter teacher course tabs**

Change `CourseTabs` props to:

```ts
export function CourseTabs({
  courseId,
  slugs,
}: {
  courseId: string;
  slugs: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const batch = searchParams.get("batch");
  const query = batch ? `?batch=${batch}` : "";
  const base = `/teacher/courses/${courseId}`;
  const tabs = TABS.filter((tab) => slugs.includes(tab.slug));

  return (
    <SubTabs
      tabs={tabs}
      hrefFor={(slug) => `${slug ? `${base}/${slug}` : base}${query}`}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
```

In `src/app/teacher/courses/[courseId]/layout.tsx`:

```ts
const slugs = teacherCourseTabSlugs(session.user.permissions, canConfigure);
// ...
<CourseTabs courseId={courseId} slugs={slugs} />
```

- [ ] **Step 4: Redirect forbidden tabs**

After `loadCourseWorkspace` in each view (teacher portal only):

- `CourseRosterView`: if `!hasStudentsRead(session.user.permissions)` → `redirect(firstTeacherCoursePath(courseId, session.user.permissions))`
- `CourseUploadsView` / `CourseAssignmentsView` / assignment-detail: if `!hasCoursesRead(...)` → same redirect
- `CourseAttendanceView`: if `!hasAttendanceAccess(...)` → same redirect

Admin portal (`portal === "admin"`): skip these redirects; admin pages stay manage-gated by their layouts.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/course-workspace/sessions.tsx \
  src/components/course-workspace/session-detail.tsx \
  src/components/course-tabs.tsx \
  src/app/teacher/courses/[courseId]/layout.tsx \
  src/components/course-workspace/roster.tsx \
  src/components/course-workspace/uploads.tsx \
  src/components/course-workspace/assignments.tsx \
  src/components/course-workspace/assignment-detail.tsx \
  src/components/course-workspace/attendance.tsx
git commit -m "$(cat <<'EOF'
fix(sessions): hide writes without sessions.manage
EOF
)"
```

---

### Task 4: Teacher portal entry and nav

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/teacher/layout.tsx`
- Modify: `src/app/teacher/account/actions.ts`
- Modify: `src/app/teacher/students/page.tsx`
- Modify: `src/app/teacher/page.tsx` (optional redirect if no `hasCoursesRead` and `hasStudentsRead`)

- [ ] **Step 1: Home and layout**

`src/app/page.tsx` — keep the admin-first branch. Change the teacher branch to:

```ts
if (TEACHER_PORTAL_PERMISSIONS.some((key) => permissions.includes(key))) {
  redirect("/teacher");
}
```

Admin-only keys (`users.manage`, `roles.manage`) still redirect `/admin` first so Admin does not land on `/teacher`.

`src/app/teacher/layout.tsx`:

```ts
const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
const perms = session.user.permissions;
```

Nav:

```tsx
{hasCoursesRead(perms) && (
  <Link href="/teacher" className="text-white/70 hover:text-accent">
    Courses
  </Link>
)}
{hasStudentsRead(perms) && (
  <Link href="/teacher/students" className="text-white/70 hover:text-accent">
    Students
  </Link>
)}
```

Account + sign out unchanged.

- [ ] **Step 2: Students page and account action**

`src/app/teacher/students/page.tsx` — replace the bare `auth()` null return:

```ts
const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
if (!hasStudentsRead(session.user.permissions)) redirect("/teacher");
```

`src/app/teacher/account/actions.ts` — `requireAnyPermission(TEACHER_PORTAL_PERMISSIONS)`.

`src/app/teacher/page.tsx` — if `!hasCoursesRead(session.user.permissions)` and `hasStudentsRead(...)`, `redirect("/teacher/students")`. Still `auth()`/`requireAnyPermission` so a sessions.read user sees the course list (sessions.read does not imply courses.read; they need a landing). **Do not redirect sessions.read-only users away from `/teacher`.** Only redirect when they have students.read and not courses.read and not sessions.read.

```ts
const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
if (!hasCoursesRead(session.user.permissions) && !hasSessionsRead(session.user.permissions) && hasStudentsRead(session.user.permissions)) {
  redirect("/teacher/students");
}
```

- [ ] **Step 3: Seed local permissions**

Run: `npx prisma db seed`

Expected: seed completes; `/admin/roles` shows `courses.read`, `sessions.read`, `students.read` after login.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/teacher/layout.tsx src/app/teacher/account/actions.ts \
  src/app/teacher/students/page.tsx src/app/teacher/page.tsx
git commit -m "$(cat <<'EOF'
feat(teacher): gate portal nav by read permissions
EOF
)"
```

---

### Task 5: e2e for sessions.read without New session

**Files:**
- Modify: `e2e/db.ts`
- Create: `e2e/teacher-session-read.spec.ts`

- [ ] **Step 1: Fixture**

Add to `e2e/db.ts`:

```ts
export async function createStaffWithPermissions(
  name: string,
  email: string,
  password: string,
  permissionKeys: string[],
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  if (permissions.length !== permissionKeys.length) {
    throw new Error(`Missing permission rows: ${permissionKeys.join(", ")}. Re-seed the test database.`);
  }
  const role = await prisma.role.create({
    data: {
      name: `Role ${email}`,
      description: "e2e custom",
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });
  return prisma.user.create({
    data: { name, email, passwordHash, roles: { create: [{ roleId: role.id }] } },
  });
}
```

- [ ] **Step 2: Write the e2e**

`e2e/teacher-session-read.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { login, unique } from "./helpers";
import { createCourse, createSession, createStaffWithPermissions } from "./db";
import { PERMISSIONS } from "../src/lib/permissions";

test.describe("teacher: sessions.read", () => {
  test("sees assigned sessions but not New session", async ({ page }) => {
    const password = "ViewerPass123!";
    const viewer = await createStaffWithPermissions(
      `Session Viewer ${unique("t")}`,
      `${unique("sessionviewer")}@example.com`,
      password,
      [PERMISSIONS.SESSIONS_READ],
    );
    const course = await createCourse(`View Course ${unique("c")}`, unique("VWC").toUpperCase(), viewer.id);
    await createSession(course.batches[0].id, viewer.id, new Date("2026-03-15T00:00:00.000Z"), "Visible class");

    await login(page, viewer.email, password);
    await expect(page).toHaveURL(/\/teacher/);
    await page.goto(`/teacher/courses/${course.id}`);
    await expect(page.getByText("Visible class")).toBeVisible();
    await expect(page.getByText("New session")).toHaveCount(0);
    await expect(page.locator('button:has-text("Create session")')).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run e2e**

If permission rows are missing, run `npm run test:e2e:prepare` first.

Run: `npm run test:e2e -- e2e/teacher-session-read.spec.ts e2e/teacher-courses.spec.ts e2e/teacher-schedule.spec.ts e2e/teacher-students.spec.ts`

Expected: all PASS. Teacher fixtures still see **New session**. Viewer does not.

- [ ] **Step 4: Commit**

```bash
git add e2e/db.ts e2e/teacher-session-read.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): hide New session without sessions.manage
EOF
)"
```

---

## Self-review

| Spec requirement | Task |
|---|---|
| Three keys + definitions + seed via `PERMISSION_DEFINITIONS` | 1 |
| Manage/configure imply read | 1 helpers |
| Teacher + `students.read`; no Viewer role | 1 |
| Teacher portal; admin lists unchanged | 4 (home/layout); no admin list file changes |
| Nav Courses / Students | 4 |
| Tab visibility | 2 helpers + 3 CourseTabs |
| New session / date / remove = `sessions.manage` | 3 |
| `requireCourseAccess` accepts the three reads | 2 |
| `requireBatchView` accepts `sessions.read` | 2 (`TEACHER_PORTAL_PERMISSIONS`) |
| Unit tests for helpers + Teacher grants | 1, 2 |
| e2e: `sessions.read` sees list, not New session | 5 |
| Existing teacher e2e still see New session | 5 command |
