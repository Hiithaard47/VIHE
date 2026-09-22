import Link from "next/link";
import { AddRoleDialog } from "@/modules/roles/ui/add-role-dialog";
import { FlashBanner } from "@/components/flash-banner";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import { ADMIN_PAGE_SIZE, adminListHref, parseAdminListPage, parseAdminListSearch } from "@/lib/admin-list";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

const PATH = "/admin/roles";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const { page: rawPage, q: rawQ } = await searchParams;
  const q = parseAdminListSearch(rawQ);
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const total = await prisma.role.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = parseAdminListPage(rawPage, totalPages);
  const roles = await prisma.role.findMany({
    where,
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: { name: "asc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Roles</h2>
          <AddRoleDialog />
        </div>
        <ListSearch action={PATH} tab="active" q={q} placeholder="Search by name" />
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Users</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/roles/${role.id}`} className="font-heading font-medium hover:text-accent-dark">
                      {role.name}
                    </Link>
                    {role.description && <p className="text-xs text-muted">{role.description}</p>}
                  </td>
                  <td className="px-4 py-3">{role._count.users}</td>
                  <td className="px-4 py-3">{role._count.permissions}</td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                    {q ? "No matching roles." : "No roles yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          totalPages={totalPages}
          hrefForPage={(nextPage) => adminListHref(PATH, "active", nextPage, q)}
        />
      </section>
    </div>
  );
}
