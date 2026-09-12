# Session name, category, and per-category attendance

Institution-wide session categories (Admin CRUD). Every session has a required **name** and **category**. Attendance % is computed per category. Late/Excused still follow the course policy.

## Data

- `SessionCategory`: `name` (unique), `minAttendancePercent` (null = no at-risk), `isActive`, `isSystem`
- Seed **Class** (`isSystem`, min 75%). Existing sessions become Class; `topic` becomes `name` (or `"Class"` if empty)
- Drop `Course.minAttendancePercent` and `ClassSession.topic`
- Course policy keeps default status, Late/Excused, lock-after-days

## Admin

- `/admin/session-categories` — list, add, edit name (not on Class), min %, archive (not Class)
- Permission: `courses.manage`

## Sessions

- Create: date, name, category (active only). Default category: Class
- Lists and student views: name, category, date

## Attendance

- Tally only sessions of that category
- Roster/attendance: one % column per category that has sessions on the course
- At-risk is per category, using that category’s min %
- No marked sessions in a category → `—`, not 0%

Out of scope: seva groups, sadhana card, half/full, reminder mail, per-category Late/Excused.
