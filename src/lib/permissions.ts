// Central permission registry. Add a key here + reseed to introduce a new
// permission; the admin can then attach it to any role from /admin/roles.
export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  COURSES_MANAGE: "courses.manage",
  COURSES_CONFIGURE: "courses.configure",
  STUDENTS_MANAGE: "students.manage",
  SESSIONS_MANAGE: "sessions.manage",
  ATTENDANCE_MARK: "attendance.mark",
  ATTENDANCE_VIEW: "attendance.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS: { key: PermissionKey; description: string }[] = [
  { key: PERMISSIONS.USERS_MANAGE, description: "Create, deactivate, and manage teacher/admin accounts" },
  { key: PERMISSIONS.ROLES_MANAGE, description: "Create roles and configure the permission matrix" },
  { key: PERMISSIONS.COURSES_MANAGE, description: "Create, edit, and assign teachers to courses" },
  {
    key: PERMISSIONS.COURSES_CONFIGURE,
    description: "Configure schedule, roster, and attendance policy for an assigned course",
  },
  { key: PERMISSIONS.STUDENTS_MANAGE, description: "Add students and manage course enrollment" },
  { key: PERMISSIONS.SESSIONS_MANAGE, description: "Create class sessions for a course" },
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
    ],
  },
];
