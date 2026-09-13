import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PERMISSIONS, TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.kind === "student") redirect("/student");

  const permissions = session.user.permissions;
  if (permissions.includes(PERMISSIONS.USERS_MANAGE) || permissions.includes(PERMISSIONS.ROLES_MANAGE)) {
    redirect("/admin");
  }
  if (TEACHER_PORTAL_PERMISSIONS.some((key) => permissions.includes(key))) {
    redirect("/teacher");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="font-heading text-xl font-semibold text-ink">No access assigned</h1>
      <p className="text-muted">
        You&apos;re signed in as {session.user.email}, but no role grants you access yet. Ask an admin to assign you
        a role.
      </p>
    </main>
  );
}
