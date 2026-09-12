import { notFound } from "next/navigation";
import { AdminRecordChrome } from "@/components/admin-record-chrome";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { removeSessionCategory, toggleSessionCategoryActive, updateSessionCategory } from "../actions";

export default async function AdminSessionCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const category = await prisma.sessionCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, minAttendancePercent: true, isActive: true, isSystem: true },
  });
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <AdminRecordChrome
        backHref="/admin/session-categories"
        backLabel="Session categories"
        title={category.name}
        subtitle={category.isSystem ? "System category" : "Custom category"}
        isActive={category.isActive}
        archivedNote="This category is archived. Restore to make changes."
        tabs={null}
        action={
          category.isSystem ? undefined : category.isActive ? (
            <form action={removeSessionCategory.bind(null, category.id)}>
              <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
                Remove
              </button>
            </form>
          ) : (
            <form action={toggleSessionCategoryActive.bind(null, category.id)}>
              <input type="hidden" name="nextActive" value="true" />
              <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
                Restore
              </button>
            </form>
          )
        }
      >
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
          <form
            action={updateSessionCategory.bind(null, category.id)}
            className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
          >
            <fieldset disabled={!category.isActive} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Name
                <input
                  name="name"
                  required
                  defaultValue={category.name}
                  readOnly={category.isSystem}
                  className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Minimum attendance %
                <input
                  name="minAttendancePercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={category.minAttendancePercent ?? ""}
                  className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
                />
                <span className="text-xs text-muted">Leave blank for no at-risk flag.</span>
              </label>
              {category.isActive && (
                <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
                  Save details
                </button>
              )}
            </fieldset>
          </form>
        </section>
      </AdminRecordChrome>
    </div>
  );
}
