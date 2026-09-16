import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { updateRolePermissions } from "../actions";

export default async function AdminRolePermissionsPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const [role, permissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: roleId },
      select: { permissions: { select: { permissionId: true } } },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);
  if (!role) notFound();
  const granted = new Set(role.permissions.map(({ permissionId }) => permissionId));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Permissions</h2>
      <form action={updateRolePermissions.bind(null, roleId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
        <div className="flex flex-col gap-3">
          {permissions.map((permission) => (
            <label key={permission.id} className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="permissionIds"
                value={permission.id}
                defaultChecked={granted.has(permission.id)}
                className="mt-0.5 accent-accent-dark"
              />
              <span>
                <span className="font-medium">{permission.key}</span>
                <span className="block text-xs text-muted">{permission.description}</span>
              </span>
            </label>
          ))}
        </div>
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
          Save permissions
        </button>
      </form>
    </section>
  );
}
