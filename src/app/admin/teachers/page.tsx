import Link from "next/link";
import { AddTeacherDialog } from "@/modules/teachers/ui/add-teacher-dialog";
import { BulkImportDialog } from "@/modules/bulk-import/ui/bulk-import-dialog";
import { AdminStatusTabs } from "@/components/admin-status-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import { ADMIN_PAGE_SIZE, adminListHref, containsInsensitive, parseAdminListPage, parseAdminListSearch, parseAdminListTab } from "@/lib/admin-list";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { importTeachers } from "@/modules/bulk-import/actions";

const PATH = "/admin/teachers";

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const { tab: rawTab, page: rawPage, q: rawQ } = await searchParams;
  const tab = parseAdminListTab(rawTab);
  const q = parseAdminListSearch(rawQ);
  const isActive = tab === "active";
  const where = {
    isActive,
    ...(q ? containsInsensitive(q, ["name", "email", "phone"]) : {}),
  };

  const [total, roles] = await Promise.all([
    prisma.user.count({ where }),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = parseAdminListPage(rawPage, totalPages);
  const users = await prisma.user.findMany({
    where,
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Teachers</h2>
          {isActive && (
            <div className="flex items-center gap-2">
              <BulkImportDialog
                title="Import teachers"
                action={importTeachers}
                hint="Required columns: name, email. Optional: phone, password (or set a default below). Each row gets the Teacher role. First row must be the header."
                sampleFileName="teachers-sample.csv"
                sampleCsv={`name,email,phone,password
Jane Teacher,jane.teacher@example.com,555-0100,TempPass123!
Sam Mentor,sam.mentor@example.com,,TempPass123!
`}
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Default temporary password (optional)</span>
                  <input
                    name="defaultPassword"
                    type="password"
                    minLength={8}
                    className="rounded-md border border-hairline bg-input px-3 py-2 text-ink"
                  />
                </label>
              </BulkImportDialog>
              <AddTeacherDialog roles={roles} />
            </div>
          )}
        </div>
        <AdminStatusTabs tab={tab} hrefForTab={(nextTab) => adminListHref(PATH, nextTab, 1, q)} />
        <ListSearch action={PATH} tab={tab} q={q} placeholder="Search by name, email, or mobile" />
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Teacher</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Mobile</th>
                <th className="px-4 py-2 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/teachers/${user.id}`} className="font-heading font-medium hover:text-accent-dark">
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3 text-muted">{user.phone || "—"}</td>
                  <td className="px-4 py-3">
                    {user.roles.map(({ role }) => role.name).join(", ") || <span className="text-muted">None</span>}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-muted">
                    {q ? "No matching teachers." : isActive ? "No active teachers yet." : "No archived teachers."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          totalPages={totalPages}
          hrefForPage={(nextPage) => adminListHref(PATH, tab, nextPage, q)}
        />
      </section>
    </div>
  );
}
