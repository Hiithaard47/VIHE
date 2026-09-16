import { requireAnyPermission } from "@/lib/rbac";
import { hasCoursesRead, hasStudentsRead, TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";
import { TeacherNav } from "@/components/teacher-nav";
import { UserMenu } from "@/components/user-menu";
import { AppHeader } from "@/components/app-header";
import { sessionDisplayName } from "@/lib/session-display-name";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
  const perms = session.user.permissions;
  const name = await sessionDisplayName(session);

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Teacher"
        right={<UserMenu name={name} accountHref="/teacher/account" />}
      />
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <TeacherNav showCourses={hasCoursesRead(perms)} showStudents={hasStudentsRead(perms)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
