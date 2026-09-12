import { prisma } from "@/lib/prisma";
import { FlashBanner } from "@/components/flash-banner";
import { createUser, updateUserRoles, toggleUserActive } from "./actions";

export default async function TeachersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add user</h2>
        <form action={createUser} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input name="name" placeholder="Full name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="email" type="email" placeholder="Email" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="password" type="password" placeholder="Temporary password" required minLength={8} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm text-ink">
            <legend className="mb-1 text-muted">Roles</legend>
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="roleIds" value={role.id} />
                {role.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Create user
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Users</h2>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Roles</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const activeRoleIds = new Set(user.roles.map((r) => r.roleId));
                return (
                  <tr key={user.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3 text-muted">{user.email}</td>
                    <td className="px-4 py-3">
                      <form action={updateUserRoles.bind(null, user.id)} className="flex flex-wrap items-center gap-2">
                        {roles.map((role) => (
                          <label key={role.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              name="roleIds"
                              value={role.id}
                              defaultChecked={activeRoleIds.has(role.id)}
                            />
                            {role.name}
                          </label>
                        ))}
                        <button type="submit" className="rounded-md border border-hairline px-2 py-1 text-xs text-ink hover:bg-canvas">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <span className={user.isActive ? "text-emerald-700" : "text-muted"}>
                        {user.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleUserActive.bind(null, user.id)}>
                        <input type="hidden" name="nextActive" value={(!user.isActive).toString()} />
                        <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
