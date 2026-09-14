// Central permission registry. Add a key here + reseed to insert the row
// and grant it on default roles if listed. Seed never removes grants.
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

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS: { key: PermissionKey; description: string }[] = [
  { key: PERMISSIONS.USERS_MANAGE, description: "Create, deactivate, and manage teacher/admin accounts" },
  { key: PERMISSIONS.ROLES_MANAGE, description: "Create roles and configure their permissions" },
  { key: PERMISSIONS.COURSES_MANAGE, description: "Create and archive courses; manage subjects, subject teachers, and course rosters" },
  {
    key: PERMISSIONS.COURSES_CONFIGURE,
    description: "Configure schedule, roster, and attendance policy for an assigned subject",
  },
  { key: PERMISSIONS.COURSES_READ, description: "View assigned courses and subject workspace" },
  { key: PERMISSIONS.STUDENTS_MANAGE, description: "Add students and manage course enrollment" },
  { key: PERMISSIONS.STUDENTS_READ, description: "View students enrolled in assigned courses" },
  { key: PERMISSIONS.SESSIONS_MANAGE, description: "Create class sessions and change the date of future sessions" },
  { key: PERMISSIONS.SESSIONS_READ, description: "View class sessions for assigned subjects" },
  { key: PERMISSIONS.ATTENDANCE_MARK, description: "Mark attendance for a class session" },
  { key: PERMISSIONS.ATTENDANCE_VIEW, description: "View attendance records and reports" },
];

// Seed defaults only — admin can freely edit both after seeding.
export const DEFAULT_ROLES: { name: string; description: string; isSystem: boolean; permissions: PermissionKey[] }[] = [
  {
    name: "Admin",
    description: "Full access: manage users, roles, courses, and students",
    isSystem: true,
    permissions: Object.values(PERMISSIONS),
  },
  {
    name: "Teacher",
    description: "Manage sessions and attendance for assigned courses",
    isSystem: true,
    permissions: [
      PERMISSIONS.COURSES_CONFIGURE,
      PERMISSIONS.SESSIONS_MANAGE,
      PERMISSIONS.ATTENDANCE_MARK,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.STUDENTS_READ,
    ],
  },
];

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

export const SESSION_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SESSIONS_READ,
  PERMISSIONS.SESSIONS_MANAGE,
  PERMISSIONS.ATTENDANCE_MARK,
  PERMISSIONS.ATTENDANCE_VIEW,
];

export const SUBJECT_ACCESS_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SESSIONS_MANAGE,
  PERMISSIONS.ATTENDANCE_MARK,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.COURSES_CONFIGURE,
  PERMISSIONS.COURSES_MANAGE,
];

export function hasWorkspaceWrite(permissions: readonly string[]) {
  return (
    hasSessionsManage(permissions) ||
    permissions.includes(PERMISSIONS.COURSES_CONFIGURE) ||
    permissions.includes(PERMISSIONS.COURSES_MANAGE) ||
    permissions.includes(PERMISSIONS.ATTENDANCE_MARK)
  );
}
