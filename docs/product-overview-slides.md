# Vihe Attendance — Product Overview

Short slide deck of what the app does today. Use for walkthroughs.

---

## 1. What it is

**Vihe Attendance** is the portal for VIHE courses:

- Teachers mark class attendance and run the week schedule
- Admins manage people, courses, roles, and settings
- Students view courses, download materials, and submit assignments

Built for Vrindavan Institute for Higher Education.

---

## 2. Who uses it

```mermaid
flowchart LR
  Visitor([Visitor]) --> Login["/login"]
  Visitor --> Apply["/apply"]
  Login --> Admin[Admin portal]
  Login --> Teacher[Teacher portal]
  Login --> Student[Student portal]
  Apply --> Pending[Pending application]
  Pending --> Admin
```

| Portal | Typical user | Entry |
| --- | --- | --- |
| Admin | Institute staff | `/admin` |
| Teacher | Assigned instructors | `/teacher` |
| Student | Enrolled learners | `/student` |
| Apply | Prospective students | `/apply` |

---

## 3. How access works

Permissions are **not** hardcoded role names. Admins configure a matrix:

```mermaid
flowchart TB
  User[User account] --> Roles[One or more roles]
  Roles --> Perms[Permissions]
  Perms --> Caps[What they can do]
```

- **Permission** — atomic capability (e.g. `attendance.mark`, `courses.manage`)
- **Role** — named bundle (`Admin`, `Teacher`, or custom)
- **User** — holds one or more roles

Seeded system roles: **Admin**, **Teacher** (not deletable; grants are editable).

---

## 4. Admin portal

```mermaid
flowchart TB
  Dash[Dashboard] --> Teachers
  Dash --> Courses
  Dash --> Students
  Dash --> Settings
  Settings --> Cats[Session categories]
  Settings --> Roles["Roles and permissions"]
  Courses --> Subjects
  Subjects --> Workspace["Sessions, Schedule, Attendance, Uploads, Assignments"]
```

**People**

- Teachers — create, archive, reset password, assign roles
- Students — create, enroll in courses, login expiry, archive
- Applications — approve / reject prospective students

**Courses**

- Create / archive courses and subjects
- Assign teachers to subjects
- Course roster, details, attendance policy
- Full classroom workspace (same tools teachers use)

**Settings**

- Session categories (e.g. Class, Temple) — min attendance %, allow files
- Roles & permissions matrix

---

## 5. Teacher portal

```mermaid
flowchart LR
  Home[My courses] --> Course
  Course --> Sessions
  Course --> Schedule
  Course --> Roster
  Course --> Attendance
  Course --> Uploads
  Course --> Assignments
  Course --> Settings
  Sessions --> Mark[Mark attendance]
  Schedule --> Drag[Drag or Move sessions]
```

- Open only **assigned** courses / subjects
- Create sessions; mark Present / Absent / Late / Excused
- Week schedule — drag on desktop, **Move** + tap day on phone
- Roster enrollment (when permitted)
- Upload PDF/images to sessions; issue & grade assignments
- Mobile-friendly chrome; camera **Take photo** on uploads

---

## 6. Student portal

```mermaid
flowchart LR
  Home[My courses] --> Course
  Course --> Docs[Documents]
  Course --> Asg[Assignments]
  Asg --> Submit[Upload submission]
```

- Sign in with email + portal password set by admin
- View enrolled courses and session files
- Submit assignment work (PDF / images; camera on phone)
- Change own password

---

## 7. Attendance loop

```mermaid
sequenceDiagram
  participant A as Admin
  participant T as Teacher
  participant S as Student
  A->>A: Create course, subject, enroll students
  A->>T: Assign teacher to subject
  T->>T: Schedule or create session
  T->>T: Mark attendance
  S->>S: View materials and submit work
  A->>A: Reports, policy, oversight
```

Session categories can set a **minimum attendance %** used for at-risk flags on the roster.

---

## 8. Files & assignments

| Feature | Who | Notes |
| --- | --- | --- |
| Session resources | Teacher / Admin | PDF + images; category can disable files |
| Course uploads list | Teacher / Admin | All files across sessions |
| Assignments | Teacher issues → Student submits → Teacher grades | Multi-file; due date; max marks |
| Storage | Azure Blob (Azurite locally) | |

---

## 9. Sign-in & accounts

- Credentials login for all portals
- Optional Google sign-in **only if** an admin already created that email
- No public self sign-up — use **Apply** → admin approval
- Student login can expire (admin-set)
- Each portal has Account → change password

---

## 10. One-line map

```mermaid
flowchart TB
  Root[Vihe Attendance]
  Root --> Admin
  Root --> Teacher
  Root --> Student
  Root --> Shared
  Admin --> A1[Teachers]
  Admin --> A2[Students]
  Admin --> A3[Courses]
  Admin --> A4[Roles]
  Admin --> A5[Categories]
  Teacher --> T1[Schedule]
  Teacher --> T2[Attendance]
  Teacher --> T3[Uploads]
  Teacher --> T4[Assignments]
  Student --> S1[Documents]
  Student --> S2[Submissions]
  Shared --> H1[Login]
  Shared --> H2[Apply]
  Shared --> H3[RBAC]
```

---

*Living overview of current product scope — update when major features ship.*
