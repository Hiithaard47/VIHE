import { requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminNav } from "@/components/admin-nav";
import { UserMenu } from "@/components/user-menu";
import { AppHeader } from "@/components/app-header";
import { displayUserName } from "@/lib/user-name";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAnyPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.STUDENTS_MANAGE,
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Admin"
        right={<UserMenu name={displayUserName(session.user)} accountHref="/admin/account" />}
      />
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6">
        <AdminNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
