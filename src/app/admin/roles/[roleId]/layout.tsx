import { notFound } from "next/navigation";
import { AdminRecordChrome } from "@/components/admin-record-chrome";
import { AdminSubTabs } from "@/components/admin-sub-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { deleteRole } from "@/modules/roles/actions";

export default async function AdminRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, description: true, isSystem: true },
  });
  if (!role) notFound();

  const subtitle = [role.description, role.isSystem ? "System role" : null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <AdminRecordChrome
        backHref="/admin/roles"
        backLabel="Roles"
        title={role.name}
        subtitle={subtitle}
        isActive
        archivedNote=""
        action={
          !role.isSystem ? (
            <form action={deleteRole.bind(null, role.id)}>
              <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
                Delete
              </button>
            </form>
          ) : undefined
        }
        tabs={
          <AdminSubTabs
            base={`/admin/roles/${role.id}`}
            tabs={[
              { slug: "", label: "Permissions" },
              { slug: "details", label: "Details" },
            ]}
          />
        }
      >
        {children}
      </AdminRecordChrome>
    </div>
  );
}
