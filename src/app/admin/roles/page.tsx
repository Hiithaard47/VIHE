import { prisma } from "@/lib/prisma";
import { FlashBanner } from "@/components/flash-banner";
import { createRole, updateRolePermissions, deleteRole } from "./actions";

export default async function RolesPage() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add role</h2>
        <form action={createRole} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Name
            <input name="name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Description
            <input name="description" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </label>
          <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Create role
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Permission matrix</h2>
        <p className="mb-3 text-sm text-muted">
          Check a box to grant that permission to a role, then save the column. New permission keys added to{" "}
          <code>src/lib/permissions.ts</code> show up here after reseeding.
        </p>

        {/* One hidden form per role; checkboxes below reference it via the `form` attribute so a
            single table can host N independent per-role submits without nesting <form> in <table>. */}
        {roles.map((role) => (
          <form key={role.id} id={`role-form-${role.id}`} action={updateRolePermissions.bind(null, role.id)} />
        ))}

        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Permission</th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-2 font-medium">
                    <div className="flex flex-col gap-1">
                      <span className="text-ink">{role.name}</span>
                      <span className="text-xs font-normal text-muted">{role._count.users} user(s)</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{perm.key}</p>
                    <p className="text-xs text-muted">{perm.description}</p>
                  </td>
                  {roles.map((role) => {
                    const granted = role.permissions.some((rp) => rp.permissionId === perm.id);
                    return (
                      <td key={role.id} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          form={`role-form-${role.id}`}
                          name="permissionIds"
                          value={perm.id}
                          defaultChecked={granted}
                          className="accent-accent-dark"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-4 py-3" />
                {roles.map((role) => (
                  <td key={role.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button type="submit" form={`role-form-${role.id}`} className="rounded-md border border-hairline px-2 py-1 text-xs text-ink hover:bg-canvas">
                        Save
                      </button>
                      {!role.isSystem && (
                        <form action={deleteRole.bind(null, role.id)}>
                          <button type="submit" className="text-xs text-red-700 underline">
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
