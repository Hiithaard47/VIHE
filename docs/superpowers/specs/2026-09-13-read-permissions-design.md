# Assigned-batch read permissions

Add `courses.read`, `sessions.read`, and `students.read` so staff can view assigned-batch resources without write access. Manage/configure imply the matching read. Teacher portal is the view surface. Admin org-wide lists stay `*.manage`.

## Permissions

| Key | View (assigned batches only) | Implied by |
|---|---|---|
| `courses.read` | Teacher course list + course workspace | `courses.manage`, `courses.configure` |
| `sessions.read` | Session list + session detail (no create/edit/delete) | `sessions.manage` |
| `students.read` | Teacher students list + roster (no enroll/remove) | `students.manage` |

Helpers: `hasCoursesRead`, `hasSessionsRead`, `hasStudentsRead`. A user with the write key does not need the read checkbox.

Seed via existing `PERMISSION_DEFINITIONS` upsert. No schema migration.

- **Admin:** all keys (`Object.values(PERMISSIONS)`).
- **Teacher:** current set (`courses.configure`, `sessions.manage`, `attendance.mark`, `attendance.view`) plus `students.read` so assigned students stay visible.
- No Viewer system role. Admin attaches the new keys on any role.

## Portal and nav

Read-only users stay on `/teacher`. `/admin` courses/students lists stay `courses.manage` / `students.manage`.

Home and `/teacher` layout accept the existing teacher-side keys plus the three reads.

- **Courses** nav: `hasCoursesRead`
- **Students** nav: `hasStudentsRead`

## Course tabs

- Sessions — `hasSessionsRead`
- Schedule / Settings — `courses.configure` (unchanged)
- Roster — `hasStudentsRead`
- Attendance — `attendance.view` / `attendance.mark` (unchanged)
- Uploads / Assignments — `hasCoursesRead` to view; create/upload still uses current write checks

Scope is unchanged: assigned batches. `courses.manage` remains the only org-wide pass (`BatchScope` `{ kind: "all" }`).

## Write vs view

**New session**, change date/time, and remove session require `sessions.manage`, not batch assignment (`canManage`). Assigned users without `sessions.manage` must not see that form. Session-detail already uses `canManageSession`; the Sessions list must match.

Roster add/remove stays `courses.configure`. Attendance form stays `attendance.mark`. Server actions keep their write `requireAnyPermission` checks.

`requireCourseAccess` accepts any of the three reads plus today’s manage/attendance keys so a deep link to an assigned course still opens. `requireBatchView` accepts `sessions.read` plus those same existing keys. Missing permission: redirect `/` or `/teacher`; do not show the write control.

## Tests

- Unit: registry includes the three keys; Teacher has `students.read` and still lacks `courses.manage` / `students.manage`; helpers treat manage/configure as read.
- e2e: custom role with `sessions.read` + a batch assignment — Sessions list visible, **New session** hidden. Existing teacher schedule/courses tests still see New session for Teacher.

## Out of scope

- Admin read-only org-wide lists
- Org-wide viewers (not assigned-batch)
- New Viewer system role
- Changing attendance.view / attendance.mark
