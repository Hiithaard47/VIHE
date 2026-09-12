import Link from "next/link";
import { requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { SignOutButton } from "@/components/sign-out-button";
import { AppHeader } from "@/components/app-header";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireAnyPermission([PERMISSIONS.SESSIONS_MANAGE, PERMISSIONS.ATTENDANCE_MARK, PERMISSIONS.ATTENDANCE_VIEW]);

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Teacher"
        right={
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/teacher" className="text-white/70 hover:text-accent">
              Courses
            </Link>
            <Link href="/teacher/students" className="text-white/70 hover:text-accent">
              Students
            </Link>
            <Link href="/teacher/account" className="text-white/70 hover:text-accent">
              Account
            </Link>
            <SignOutButton />
          </nav>
        }
      />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
