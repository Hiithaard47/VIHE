import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { resetUserPassword, updateUserDetails } from "../../actions";

export default async function AdminTeacherDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, isActive: true },
  });
  if (!user) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
      <form action={updateUserDetails.bind(null, userId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
        <fieldset disabled={!user.isActive} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Full name
            <input name="name" required defaultValue={user.name} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Email
            <input name="email" type="email" required defaultValue={user.email} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Mobile (optional)
            <input name="phone" type="tel" defaultValue={user.phone ?? ""} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          {user.isActive && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Save details
            </button>
          )}
        </fieldset>
      </form>
      {user.isActive && (
        <form action={resetUserPassword.bind(null, userId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <h3 className="text-sm font-medium text-ink">Reset password</h3>
          <p className="text-xs text-muted">Sets a new temporary password. The teacher can change it after signing in.</p>
          <label className="flex flex-col gap-1 text-sm text-ink">
            New password
            <input name="password" type="password" required minLength={8} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Confirm password
            <input name="confirm" type="password" required minLength={8} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Reset password
          </button>
        </form>
      )}
    </section>
  );
}
