import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { updateRoleDetails } from "../../actions";

export default async function AdminRoleDetailsPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, description: true, isSystem: true },
  });
  if (!role) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
      <form action={updateRoleDetails.bind(null, roleId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Name
          <input
            name="name"
            required
            defaultValue={role.name}
            readOnly={role.isSystem}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Description
          <input
            name="description"
            defaultValue={role.description ?? ""}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
          Save details
        </button>
      </form>
    </section>
  );
}
