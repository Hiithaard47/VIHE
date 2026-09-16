import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { AppHeader } from "@/components/app-header";
import { requireStudent } from "@/lib/rbac";
import { sessionDisplayName } from "@/lib/session-display-name";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudent();
  const name = await sessionDisplayName(session);

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Student"
        right={
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/student" className="text-white/70 hover:text-accent">
              My courses
            </Link>
            <UserMenu name={name} accountHref="/student/account" />
          </nav>
        }
      />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
