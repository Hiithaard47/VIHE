import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { AppHeader } from "@/components/app-header";
import { requireStudent } from "@/lib/rbac";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();

  return (
    <div className="min-h-screen">
      <AppHeader
        subtitle="Student"
        right={
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/student/account" className="text-white/70 hover:text-accent">
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
