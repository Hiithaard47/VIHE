# Attendance matrix per category

Teachers (and admins on a batch) keep the existing per-category % table on Attendance, and see every session’s mark as a letter grid under it.

## Layout

1. Existing % table — unchanged (one column per category that has sessions).
2. Category tabs — same `?category=` + `resolveCategoryTab` / `sessionCategoryTabs` as Sessions. Default is Class, else the first category that has sessions in scope.
3. Letter matrix for the selected category.

Legend under the tabs: `P Present · A Absent · L Late · E Excused`.

Admin batch Attendance uses the same `CourseAttendanceView`. No new tab.

## Matrix

- **Rows:** enrolled students in the scoped batch(es), name + roll no., same order as the % table (at-risk first, then name).
- **Columns:** every session in that category and scope, earliest date first, including today, future, and unmarked. Not limited to past like the % tally.
- **Cells:** `P` / `A` / `L` / `E` from `AttendanceStatus`, or `—` if no record. Read-only. Not links.
- **Headers:** `formatDisplayDate` (e.g. 15 Mar 2026). `title` = session name. Header is a link to the session page (`sessionHref`).
- **Empty category:** “No sessions in this category yet.”
- **Wide terms:** `overflow-x-auto`. Student / roll columns stay first; no sticky column required.

Marking stays on the session page. No inline edit.

## Data

- Reuse `loadCourseWorkspace` + `batchWhere` / `sessionWhere`.
- New loader: sessions in scope for the selected category (id, date, name), plus `attendanceRecord` rows for those session ids.
- Helper `statusLetter(status | null): "P" | "A" | "L" | "E" | "—"` and `statusAt(map, studentId, sessionId)`.
- Do not fold the matrix into `loadAttendanceTallies` (that query is past-only and category-aggregated).

## Tests

- Unit: `statusLetter` / `statusAt` for each status and missing record.
- e2e (teacher Attendance): two past Class sessions, one PRESENT and one ABSENT for a student — % table shows `50%`, matrix shows `P` and `A` under those dates. A Temple session on another tab does not appear in the Class matrix.

## Out of scope

- Inline marking / lockAfterDays in the grid
- A separate Attendance Matrix tab
- Sticky first column
- Student portal
- Changing Roster (Roster keeps % only)
