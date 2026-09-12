import Link from "next/link";
import { requireAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { SignOutButton } from "@/components/sign-out-button";
import { AppHeader } from "@/components/app-header";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/session-categories", label: "Session categories" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/roles", label: "Roles & permissions" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAnyPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.COURSES_MANAGE,
    PERMISSIONS.STUDENTS_MANAGE,
  ]);

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Admin"
        right={
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin/account" className="text-white/70 hover:text-accent">
              Account
            </Link>
            <SignOutButton />
          </nav>
        }
      />
      <div className="mx-auto flex max-w-5xl gap-8 px-4 py-6">
        <nav className="flex w-44 shrink-0 flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-ink hover:bg-card hover:text-accent-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
