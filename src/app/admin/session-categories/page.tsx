import Link from "next/link";
import { AddSessionCategoryDialog } from "@/components/add-session-category-dialog";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { removeSessionCategory, toggleSessionCategoryActive } from "./actions";

export default async function AdminSessionCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const { tab } = await searchParams;
  const archived = tab === "archived";
  const categories = await prisma.sessionCategory.findMany({
    where: { isActive: !archived },
    include: { _count: { select: { sessions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Session categories</h2>
          <AddSessionCategoryDialog />
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href="/admin/session-categories"
            aria-current={!archived ? "page" : undefined}
            className={!archived ? "font-semibold text-ink" : "text-muted hover:text-ink"}
          >
            Active
          </Link>
          <Link
            href="/admin/session-categories?tab=archived"
            aria-current={archived ? "page" : undefined}
            className={archived ? "font-semibold text-ink" : "text-muted hover:text-ink"}
          >
            Archived
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Min %</th>
                <th className="px-4 py-2 font-medium">Files</th>
                <th className="px-4 py-2 font-medium">Sessions</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/session-categories/${category.id}`}
                      className="font-heading font-medium hover:text-accent-dark"
                    >
                      {category.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{category.minAttendancePercent ?? "—"}</td>
                  <td className="px-4 py-3">{category.allowsResources ? "Files" : "No files"}</td>
                  <td className="px-4 py-3">{category._count.sessions}</td>
                  <td className="px-4 py-3">
                    {!category.isSystem &&
                      (category.isActive ? (
                        <form action={removeSessionCategory.bind(null, category.id)}>
                          <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                            Remove
                          </button>
                        </form>
                      ) : (
                        <form action={toggleSessionCategoryActive.bind(null, category.id)}>
                          <input type="hidden" name="nextActive" value="true" />
                          <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                            Restore
                          </button>
                        </form>
                      ))}
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm text-muted">
                    {archived ? "No archived categories." : "No categories yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
