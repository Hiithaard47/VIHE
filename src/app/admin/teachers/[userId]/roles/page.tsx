import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { updateUserRoles } from "../../actions";

export default async function AdminTeacherRolesPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, roles: { select: { roleId: true } } },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();
  const activeRoleIds = new Set(user.roles.map(({ roleId }) => roleId));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Roles</h2>
      <form action={updateUserRoles.bind(null, userId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
        <fieldset disabled={!user.isActive} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4 text-sm text-ink">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="roleIds" value={role.id} defaultChecked={activeRoleIds.has(role.id)} />
                {role.name}
              </label>
            ))}
          </div>
          {user.isActive && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Save roles
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
