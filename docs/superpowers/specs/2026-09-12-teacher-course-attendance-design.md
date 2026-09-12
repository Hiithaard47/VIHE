# Teacher course configuration and attendance — design

**Date:** 2026-09-12
**Status:** Approved, ready for implementation planning

## Problem

A teacher currently owns almost nothing about the courses they teach.

`/teacher` renders a flat grid of *every* active course — assigned or not — with no
sense of time. `/teacher/courses/[courseId]` does one thing: hand-create a class
session from a date and an optional topic, and list the sessions created so far.
`/teacher/students` is a read-only table whose own copy tells the teacher to go ask
an admin. Every configuration action lives behind `courses.manage`, which only
admins hold.

The schema has no notion of when a course meets. A course that meets every Monday
and Thursday for sixteen weeks requires a teacher to hand-create thirty-two
sessions, one date at a time. There is also no attendance policy: the default
status of an unmarked student is hardcoded to `PRESENT` in
`src/app/teacher/sessions/[sessionId]/page.tsx:34`, nothing computes an attendance
percentage, and marked attendance can be edited forever.

## Goals

- A teacher can configure the courses they are assigned to: details, roster,
  recurring schedule, and attendance policy.
- Sessions generate from a weekly schedule instead of being hand-created.
- The daily job — mark today's class — is reachable in one action from sign-in and
  works on a phone held in a classroom.
- Attendance carries enough policy to flag a student who is falling behind.

## Non-goals

- Admin screens (`/admin/*`) are unchanged. `courses.manage` keeps its current
  meaning.
- No self sign-up, no grading, no notifications. No views in which a student signs
  in to see their own attendance; `/teacher/students/[studentId]` is a teacher's
  view *of* a student.
- No `Term` entity. Recurring terms may turn out to be real later; this design
  does not speculate on them.
- No timezone support. See *Assumptions*.

## Decisions

Settled during brainstorming, recorded so the implementation does not relitigate
them:

| Decision | Choice |
|---|---|
| Scope | One combined spec covering roster, schedule, details/policy, and attendance UX. The size risk was raised and accepted. |
| Permission model | New `courses.configure`, scoped to assigned courses. `courses.manage` stays admin-only. |
| Schedule shape | Weekly pattern plus term dates; each slot carries its own time. |
| Session generation | Materialise every meeting as a real `ClassSession`; protect anything already marked. |
| Policy fields | Minimum attendance %, which statuses count as attended, default status on a fresh session, lock after N days. |
| Course navigation | Tabbed workspace: Sessions, Roster, Schedule, Settings. |
| Teacher landing page | Today block, then my courses, then all courses collapsed. |
| Marking interaction | Exception marking — seed from the course default, tap a row to cycle. |
| Schedule editing | Change summary shown before commit. |
| Roster and grid | One Roster tab with a List / Grid toggle. |

## Assumptions

**One institution, one timezone.** Session dates are stored at UTC midnight and
times are stored as wall-clock minutes from midnight. Nothing converts between
zones, and "is this class today" is evaluated against the server's local date. This
is deliberate: storing `18:00` inside a `DateTime` would make the displayed time
drift with the server's zone and shift by an hour across a DST boundary mid-term.
The cost is that a deployment serving two timezones would show the wrong "today"
to one of them. Add `Course.timeZone` when that is actually false, not before.

## Data model

### New permission

`src/lib/permissions.ts` gains:

```ts
COURSES_CONFIGURE: "courses.configure"
```

with the description "Configure schedule, roster, and attendance policy for an
assigned course", added to the `Teacher` entry in `DEFAULT_ROLES`.

### Course

```prisma
model Course {
  // ... existing fields unchanged ...

  // Schedule. Null bounds mean the course is unscheduled: manual sessions only,
  // which is exactly today's behaviour for every existing row.
  startDate DateTime?
  endDate   DateTime?

  // Attendance policy.
  defaultStatus           AttendanceStatus @default(PRESENT)
  minAttendancePercent    Int?             // null = no at-risk flag
  lateCountsAsAttended    Boolean          @default(true)
  excusedCountsAsAttended Boolean          @default(true)
  lockAfterDays           Int?             // null = never locks

  scheduleSlots CourseScheduleSlot[]
}
```

Two booleans rather than a `countsAsAttended AttendanceStatus[]`: `PRESENT` always
counts and `ABSENT` never does, so an array can only introduce states that are
invalid by construction.

### CourseScheduleSlot

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

### ClassSession

```prisma
model ClassSession {
  // ... existing fields unchanged ...

  startMinute Int?    // copied from the slot at generation time
  endMinute   Int?
  slotId      String? // null = hand-created and never auto-removed;
                      // set = generated and eligible for regeneration
}
```

`slotId` is provenance, not a foreign key with a cascade — a slot can be deleted
while its already-marked sessions must survive. It is a plain nullable column.

## Permissions and access

`src/lib/rbac.ts` gains one guard:

```ts
requireCourseConfigure(courseId)
```

It requires `COURSES_CONFIGURE` (or `COURSES_MANAGE`, which admins hold) and then
applies the existing `canManageCourse` check, so a teacher can configure only the
courses they are assigned to. Every server action under `roster/`, `schedule/`, and
`settings/` opens with it.

The course layout decides which tabs render, but tab visibility is presentation,
not access control: each tab's page and each action re-checks independently. A
teacher who is not assigned to a course sees Sessions and a read-only Roster, and
is redirected away from `/schedule` and `/settings` if they type the URL.

## Routes and screens

```
/teacher                                     today block, my courses, all courses (collapsed)
/teacher/courses/[courseId]/layout.tsx       course shell: breadcrumb, tab strip, one course fetch
                          /page.tsx          Sessions  (default tab)
                          /roster/page.tsx   Roster    (?view=grid for the matrix)
                          /schedule/page.tsx Schedule
                          /settings/page.tsx Settings  (details + attendance policy)
/teacher/sessions/[sessionId]/page.tsx       marking screen — route unchanged
/teacher/students/page.tsx                   all students — existing
/teacher/students/[studentId]/page.tsx       NEW cross-course attendance history
```

The course layout is what keeps each tab a small focused file rather than growing
today's `page.tsx` into a four-concern screen.

### `/teacher` — landing

Three stacked regions:

1. **Today** — sessions scheduled for the server's current date across courses the
   teacher is assigned to, each showing time, course, topic, and enrolment count.
   An unmarked session gets a primary *Mark attendance* action; a marked one shows
   its tally. When nothing meets today, the region states that rather than
   collapsing to nothing.
2. **My courses** — assigned courses with their weekly pattern, next meeting date,
   and a count of past unmarked sessions.
3. **All courses** — every other active course, collapsed, view-only. This replaces
   today's behaviour of showing all courses at equal weight.

### Sessions tab

Upcoming and past sessions for the course. The manual create-session form stays —
it is the escape hatch for a one-off class and for backfilling a date the schedule
never generated.

### Roster tab

A List / Grid toggle over the same students.

**List** is the default: student, attendance percentage, at-risk badge, and a
remove control, plus an *Enroll student* action that picks from existing `Student`
records. It is the phone-friendly view.

**Grid** is the student × session matrix, editable in place with the same autosave
as the marking screen. It windows to the most recent 30 sessions with paging; a
full term against a large class is otherwise a very wide table and a large payload.

Student names in either view link to `/teacher/students/[studentId]`.

### `/teacher/students/[studentId]`

One student across every course they are enrolled in: per-course attendance
percentage with the at-risk badge, and a reverse-chronological list of their
records with date, course, status, and who marked it. Read-only — edits happen on
the session or in the grid. Reachable from the Roster tab and from
`/teacher/students`.

### Schedule tab

Term start and end dates, plus a list of weekly slots each with a weekday and a
start and end time. Saving does not write immediately — it shows a change summary
(below) and commits only on confirmation.

### Settings tab

Course details (name, code, description) and the four attendance policy fields.

## Schedule engine

Two pure functions in `src/lib/schedule.ts`, with no Prisma import, so the entire
regeneration rule is unit-testable without a database:

```ts
generateMeetings(windowStart, windowEnd, slots) → Meeting[]
diffSchedule(existingSessions, desiredMeetings, today) → { create, remove, keep }
```

### Protection rule

A session is **protected** — never touched by regeneration — if any of:

- it has at least one attendance record;
- its date is in the past;
- its `slotId` is null, meaning a human created it by hand.

**Removal** applies only to sessions that are generated, dated today or later,
carry zero attendance records, and are absent from the desired set.

**Creation** fills desired meetings that have no existing session at the same date
and start time. An existing manual session at that date and time suppresses
creation and keeps its manual status; it is not adopted into the schedule.

### Generation window

The caller derives the window and passes it in; `generateMeetings` itself has no
notion of "today". Edits generate over `[max(startDate, today), endDate]`. Past meetings are not
back-filled, so adding a Saturday slot in November does not conjure empty
Saturdays reaching back to September.

The **first** save on a course generates the full `[startDate, endDate]` instead,
because a teacher setting up a schedule six weeks into term needs those past
sessions in order to backfill attendance. "First save" means the course currently
has no sessions with a non-null `slotId`.

### Moving a slot's time

Because the slot's unique key includes `startMinute`, changing a time is a removal
plus a creation. Future unmarked meetings move; already-marked ones keep their
original time. The change summary must say so explicitly — *"6 kept at 18:00"* —
rather than leaving the teacher to discover the inconsistency in December.

### Preview and apply

Two server actions. `previewSchedule` is read-only and feeds the confirmation
panel. `applySchedule` **recomputes the diff server-side** from the submitted
pattern and applies that result inside a single `prisma.$transaction`.

The client never submits a list of session IDs to delete. If it did, a stale or
tampered preview would become a way to delete exactly the marked sessions the
protection rule exists to defend.

### Date arithmetic

Dates step by calendar day in UTC, never by adding 86,400,000 milliseconds. With
UTC-midnight dates and wall-clock minutes, a term spanning a DST boundary neither
drifts by an hour nor skips or duplicates a day.

## Attendance policy and marking

### Seeding

Each student's row starts at their existing record's status, or
`course.defaultStatus` when they have no record for that session. This replaces the
hardcoded `PRESENT` at `src/app/teacher/sessions/[sessionId]/page.tsx:34`.

### Interaction

Tapping a row cycles `PRESENT → ABSENT → LATE → EXCUSED → PRESENT`. The full four-status picker
opens directly on a long press (touch), a right-click or a second tap on the status
chip (pointer), and on focusing the row's radiogroup (keyboard) — so a rare status
is never three taps deep on any input device. Effort scales
with how unusual the day was rather than with class size, which is what makes a
configurable default status worth having.

### Accessibility

The four `sr-only` radio inputs in the current form stay in the DOM as a real
radiogroup with labels. Keyboard and screen-reader users get a proper control, and
row-tap-to-cycle is a progressive enhancement layered over it. A bare cycling
`<div>` would be a regression against what already ships.

Autosave is unchanged, including the `lastHandled` ref in `attendance-form.tsx`.
That ref compares by reference rather than using a boolean first-render flag
because Strict Mode replays the effect against the same `statuses` object, and a
boolean guard flips permanently on the replay and silently re-arms autosave on
every mount. It is deliberate and must survive the rewrite.

### Locking

`isLocked(session, policy, now)` is true when `lockAfterDays` is set and the
session's date is more than that many days in the past. It gates the UI, and
`markAttendance` re-checks it before writing — a disabled button is not a
permission check. A user holding `courses.manage` overrides the lock; the existing
`markedById` already records who made the edit. A locked session renders read-only
and states why.

### At-risk computation

Attendance percentage is computed, never stored.

- **Denominator:** sessions for the course dated in the past that have at least one
  attendance record. A session the teacher never marked must not count against a
  student.
- **Numerator:** that student's records whose status counts as attended, per
  `lateCountsAsAttended` and `excusedCountsAsAttended`. `PRESENT` always counts,
  `ABSENT` never does.
- **At risk:** `minAttendancePercent` is set and the percentage is strictly below
  it. A student sitting exactly at the threshold is not at risk.
- **No marked sessions:** no percentage is shown, not `0%`.

A single `groupBy` over `AttendanceRecord` by `studentId` for the course yields
every student's tallies; percentages are derived in memory. The roster list and the
grid share that data, so the Roster tab costs two queries regardless of class size.

## Validation and errors

Through the existing Zod plus `flashUrl` pattern already used across
`admin/courses/actions.ts`:

- Two slots on the same weekday may not overlap in time.
- `endDate` may not precede `startDate`.
- `minAttendancePercent`, when present, is an integer from 0 to 100.
- `lockAfterDays`, when present, is a non-negative integer.
- `endMinute` must be greater than `startMinute`, and both within 0–1439.
- Course code keeps its existing unique-constraint flash via
  `isUniqueConstraintError`.

## Migration and seeding

Schema changes are additive; every new column is nullable or carries a default, so
no data migration is required.

Existing courses have null term bounds and therefore stay unscheduled with manual
sessions only — today's behaviour exactly. `defaultStatus` defaults to `PRESENT`,
matching the value currently hardcoded in the session page.

The one step that is not automatic: `courses.configure` must reach the `Teacher`
role. `prisma/seed.ts` needs an idempotent grant, and existing installs must re-run
`npm run db:seed` after migrating. Without it, teachers see no configuration tabs.

## Testing

### Vitest (new)

Added as a dev dependency with `include: ["src/**/*.test.ts"]`. Playwright's
`testDir` is already `./e2e`, so the two runners' globals do not collide.

`lib/schedule.ts`:

- `generateMeetings`: weekday selection; inclusive term bounds; a term crossing a
  DST boundary; empty slot list; a slot whose weekday never occurs in range.
- `diffSchedule`: slot added; slot removed; slot time moved; term shortened past
  already-marked sessions; term extended; a no-op save producing an empty diff;
  and each of the three protection reasons independently.
- First-save full-term window versus edit future-only window.

`lib/attendance.ts`:

- Percentage with each combination of the late and excused booleans.
- At-risk boundary — exactly at threshold is not at risk.
- Zero marked sessions yields no percentage rather than `0%`.
- `isLocked` on either side of the cutoff, and with `lockAfterDays` null.

### Playwright (extended)

- A teacher saves a schedule and the generated sessions appear.
- Editing a schedule shows the change summary, and applying it leaves an
  already-marked session intact.
- Enrol and unenrol a student from the Roster tab.
- Exception marking end to end, including autosave.
- Editing a cell in the grid view.
- A locked session refuses an edit, and an admin can still edit it.
- An unassigned teacher sees no Schedule or Settings tab **and** is redirected when
  requesting those URLs directly.

The suite stays at `workers: 1` — several specs mutate shared state against one
real database.

## Risks

- **Scope.** Four subsystems in one spec. This was raised during brainstorming and
  accepted. The likeliest failure is the schedule engine taking longer than the
  rest combined; it is also the piece with the most unit coverage, so it should
  fail loudly rather than quietly.
- **The first-save window rule** is the one non-obvious branch in generation. It is
  called out in the tests specifically so a later refactor does not flatten it.
- **Grid payload** on large courses is mitigated by windowing to 30 sessions, but
  the window size is a guess and may need tuning against real data.
