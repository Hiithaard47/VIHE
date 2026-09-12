# Course batches (morning / evening) — design

**Date:** 2026-09-12  
**Status:** Approved, ready for implementation planning

## Problem

Admins can create a course and assign multiple teachers to it, but today those
teachers share one roster, one schedule, and one set of sessions. Real courses
like Bhakti Sastra run as separate **batches** (e.g. morning and evening), each
handled by a different teacher, with its own students, meeting times, and
attendance.

There is no batch (or group/section) entity in the schema. `CourseTeacher` and
`CourseEnrollment` hang directly off `Course`.

## Goals

- One course can have many batches; each batch has its own teacher(s), roster,
  schedule, sessions, and attendance.
- A student belongs to **at most one batch per course**.
- Admin UI: course list → course detail (batches / details / policy) → batch
  detail (overview / teachers / roster). Student admin can also set
  course → batch enrollment.
- Admin-only for batch management screens today, via existing permissions so
  later roles (Admission Admin, Facilitator) can be granted access without new
  code.
- Teachers work at **batch** scope; a morning teacher cannot mark evening
  attendance.
- Existing data migrates cleanly (one default batch per course).

## Non-goals

- Student-facing UI or self-service batch choice.
- Notifications, grading, or co-teaching UX beyond multi-select teacher assign.
- New permission keys in v1 (reuse `courses.manage` / `students.manage` /
  `courses.configure`).
- Admin schedule/session screens on the batch (teacher owns schedule).
- Renaming or fancy UX for the migrated “Default” batch beyond leaving it as a
  normal editable batch.

## Decisions

| Decision | Choice |
|---|---|
| Model | First-class `CourseBatch` under `Course` |
| Student placement | One batch per course |
| Who manages batches (v1) | Anyone with `courses.manage` (Admin today) |
| Course vs batch ownership | Course: identity + attendance policy. Batch: teachers, roster, schedule, sessions |
| Admin navigation | Course detail page (not expandable list / split pane) |
| Batch edit UX | Dedicated batch detail page |
| Admin batch tabs | Overview · Teachers · Roster only |
| Student assignment | Both batch Roster tab and `/admin/students` |
| Teacher routes | `/teacher/batches/[batchId]/…` |
| Empty new course | Auto-create a “Default” batch when the course is created |
| Migration | One “Default” batch per existing course; move teachers, enrollments, slots, sessions |

## Assumptions

- Batch names are unique within a course (e.g. “Morning” and “Evening”), not
  globally.
- A batch may have zero or more teachers; zero means no teacher can mark
  attendance for it until assigned.
- Course-level policy (`defaultStatus`, min %, lock days, etc.) applies to all
  batches of that course. Schedule slots and sessions are per batch.
- Continues the one-institution / one-timezone assumption from the teacher
  course-attendance design.

## Data model

### Course

Unchanged as the shared identity and policy holder. Relations that move off
`Course`:

- Remove direct: `teachers` (`CourseTeacher`), `enrollments`
  (`CourseEnrollment`), `sessions` (`ClassSession`), `scheduleSlots`
  (`CourseScheduleSlot`).
- Add: `batches CourseBatch[]`.
- Keep: `applications` (desired course remains course-level).

### CourseBatch (new)

```prisma
model CourseBatch {
  id        String   @id @default(cuid())
  courseId  String
  name      String   // e.g. "Morning", "Evening", "Default"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course        Course               @relation(...)
  teachers      BatchTeacher[]
  enrollments   BatchEnrollment[]
  scheduleSlots CourseScheduleSlot[]
  sessions      ClassSession[]

  @@unique([courseId, name])
  @@map("course_batches")
}
```

### BatchTeacher (replaces CourseTeacher)

```prisma
model BatchTeacher {
  batchId   String
  teacherId String

  batch   CourseBatch @relation(...)
  teacher User        @relation(...)

  @@id([batchId, teacherId])
  @@map("batch_teachers")
}
```

### BatchEnrollment (replaces CourseEnrollment)

```prisma
model BatchEnrollment {
  batchId   String
  studentId String
  createdAt DateTime @default(now())

  batch   CourseBatch @relation(...)
  student Student     @relation(...)

  @@id([batchId, studentId])
  @@map("batch_enrollments")
}
```

**One batch per course per student:** every enrollment write loads the target
batch’s `courseId`, deletes any existing `BatchEnrollment` for that student on
other batches of the same course, then inserts the new row—in one transaction.
No denormalized `courseId` on `BatchEnrollment` in v1 (avoids dual sources of
truth); add a DB constraint later only if writes prove hard to keep correct.

### CourseScheduleSlot / ClassSession

Both change `courseId` → `batchId`. Attendance records stay on `ClassSession`
and thus follow the batch.

### User

`taughtCourses CourseTeacher[]` becomes `taughtBatches BatchTeacher[]`.

## Permissions and access

No new permission keys in v1.

| Permission | Behaviour |
|---|---|
| `courses.manage` | Create/edit/archive courses; create/edit/archive batches; assign batch teachers; manage batch roster from admin. |
| `students.manage` | Create students; set enrollments as course → batch. |
| `courses.configure` | Configure schedule (and teacher-side roster if already granted) for **assigned batches**. Course policy edits remain for users who can configure; policy is stored on `Course`. |
| `sessions.manage` / `attendance.mark` / `attendance.view` | Scoped via `BatchTeacher` (or `courses.manage` for admins). |

`canManageCourse` / `requireCourseAccess` / `canConfigureCourse` become
batch-scoped equivalents (`canManageBatch`, etc.). Admins with `courses.manage`
retain access to every batch.

Later roles (Admission Admin, Facilitator) receive access by attaching these
existing permissions on `/admin/roles`.

## Admin UI

### `/admin/courses`

- Create course: name, code, description (no teacher checkboxes). On create,
  also create a **Default** batch.
- List: course, batch count, student count (sum across batches), status, link
  into course detail.

### `/admin/courses/[courseId]`

Tabs:

1. **Batches** — list (name, teacher summary, student count); **Add batch**
   creates a batch and navigates to its detail page.
2. **Details** — course name, code, description, active/archive.
3. **Policy** — shared attendance policy fields (same fields as today’s course
   policy).

### `/admin/courses/[courseId]/batches/[batchId]`

Tabs:

1. **Overview** — batch name, active flag.
2. **Teachers** — assign users as batch teachers.
3. **Roster** — search/add/remove students for this batch (enforces one batch
   per course).

### `/admin/students`

Enrollment UI changes from course checkboxes to **course → batch** selectors.
Same underlying `BatchEnrollment` as the batch Roster tab.

## Teacher UI

- Landing lists **assigned batches**, labeled with course name (e.g. “Bhakti
  Sastra · Morning”).
- Workspace tabs (Sessions, Roster, Schedule, Settings) live under
  `/teacher/batches/[batchId]/…`.
- Schedule generation and attendance marking use the batch’s slots, sessions,
  and enrollments.
- Course policy is read from (and, with `courses.configure`, editable on) the
  parent course—edits affect every batch. Schedule is per batch only.

## Migration

For each existing `Course`:

1. Insert `CourseBatch` with `name = "Default"`.
2. Rewrite `CourseTeacher` → `BatchTeacher` for that batch.
3. Rewrite `CourseEnrollment` → `BatchEnrollment`.
4. Point `CourseScheduleSlot` and `ClassSession` rows at the batch.
5. Drop old join tables / `courseId` FKs as replaced.

Idempotent, transactional migration SQL (or Prisma migrate + data step). After
migrate, no code path should read `CourseTeacher` / `CourseEnrollment`.

## Edge cases

- Archiving a course hides it and its batches from normal teacher lists;
  restoring restores them.
- Archiving a batch: soft (`isActive = false`); do not hard-delete batches that
  have attendance history.
- Empty teacher list on a batch: batch visible to admin; no teacher can open it
  as assigned.
- Applications still target a `Course`. Approving an applicant creates the
  student as today; placing them into a batch is a separate admin step
  (Students page or batch Roster)—approve flow does not pick a batch in v1.

## Testing

- E2E admin: create course (Default batch exists) → add Morning & Evening →
  assign different teachers → enroll student in Morning only.
- E2E teacher: morning teacher sees student and can mark; evening teacher does
  not see that student on evening roster.
- Update existing admin-courses, admin-students, teacher-*, attendance specs for
  batch routes and assignment.
- Unit/RBAC: `canManageBatch` true for assigned teacher and admin; false for
  other teachers.

## Relationship to prior design

Builds on
[2026-09-12-teacher-course-attendance-design.md](./2026-09-12-teacher-course-attendance-design.md).
That design’s schedule, policy, and teacher workspace remain valid, with the
unit of teaching work shifted from `Course` to `CourseBatch`. Course retains
shared policy fields; slots/sessions move to the batch.
