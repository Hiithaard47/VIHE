# Attendance Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Attendance % table and add a read-only per-category letter matrix of every session.

**Architecture:** Pure helpers for letters and mark lookup. One scoped session+records load. Same `CourseAttendanceView` for teacher and admin, with `?category=` tabs like Sessions.

**Tech Stack:** Next.js App Router, Prisma, Vitest, Playwright.

## Global Constraints

- Cells are `P` `A` `L` `E` or `—`; read-only
- Matrix includes all sessions in scope (not past-only)
- `%` tally stays past-only via `loadAttendanceTallies`
- Marking stays on the session page
- Theme tokens only (`ink`, `muted`, `hairline`, `card`, `canvas`)

---

### Task 1: Letter and mark helpers

**Files:**
- Modify: `src/lib/attendance.ts`, `src/lib/attendance.test.ts`
- Modify: `src/lib/course-attendance.ts`, `src/lib/course-attendance.test.ts`
- Modify: `src/lib/course-workspace.ts`, `src/lib/course-workspace.test.ts`

**Produces:**
- `statusLetter(status?: StatusValue | null): string`
- `recordMark` / `statusAt` on `Map<studentId, Map<sessionId, StatusValue>>`
- `attendanceHref(portal, courseId, categoryId?, batchId?)`

- [x] Failing unit tests, then helpers, then `npx vitest run`

### Task 2: Attendance page matrix

**Files:**
- Modify: `src/components/course-workspace/attendance.tsx`
- Modify: `src/app/teacher/courses/[courseId]/attendance/page.tsx`
- Modify: `src/app/admin/courses/[courseId]/batches/[batchId]/attendance/page.tsx`

- [x] % table unchanged; tabs + matrix below; pass `category` searchParam

### Task 3: e2e

**Files:**
- Create: `e2e/teacher-attendance.spec.ts`

- [x] Two past Class sessions (P + A) → `50%` and letters; Temple tab hides Class columns
- [x] `npm run test:e2e -- e2e/teacher-attendance.spec.ts e2e/admin-session-categories.spec.ts`
