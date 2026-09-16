import { notFound } from "next/navigation";
import { AdminRecordChrome } from "@/components/admin-record-chrome";
import { AdminSubTabs } from "@/components/admin-sub-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { toggleUserActive } from "../actions";

export default async function AdminTeacherLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <AdminRecordChrome
        backHref="/admin/teachers"
        backLabel="Teachers"
        title={user.name}
        subtitle={user.email}
        isActive={user.isActive}
        archivedNote="This teacher is archived. Restore to make changes."
        action={
          <form action={toggleUserActive.bind(null, user.id)}>
            <input type="hidden" name="nextActive" value={(!user.isActive).toString()} />
            <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              {user.isActive ? "Archive" : "Restore"}
            </button>
          </form>
        }
        tabs={
          <AdminSubTabs
            base={`/admin/teachers/${user.id}`}
            tabs={[
              { slug: "", label: "Assignments" },
              { slug: "details", label: "Details" },
              { slug: "roles", label: "Roles" },
            ]}
          />
        }
      >
        {children}
      </AdminRecordChrome>
    </div>
  );
}
