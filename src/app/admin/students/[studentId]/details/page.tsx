import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { toDateInputValue } from "@/lib/time";
import { updateStudentDetails } from "@/modules/students/actions";

export default async function AdminStudentDetailsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  await requireAnyPermission([PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.COURSES_MANAGE]);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { name: true, rollNumber: true, email: true, phone: true, isActive: true, loginExpiresAt: true },
  });
  if (!student) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Details</h2>
      <form action={updateStudentDetails.bind(null, studentId)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
        <fieldset disabled={!student.isActive} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Full name
            <input name="name" required defaultValue={student.name} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Roll number
            <input name="rollNumber" required defaultValue={student.rollNumber} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Email
            <input name="email" type="email" defaultValue={student.email ?? ""} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Mobile (optional)
            <input name="phone" type="tel" defaultValue={student.phone ?? ""} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Portal password
            <input name="password" type="password" minLength={8} placeholder="Leave blank to keep the current password" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Login expires on
            <input
              name="loginExpiresAt"
              type="date"
              defaultValue={student.loginExpiresAt ? toDateInputValue(student.loginExpiresAt) : ""}
              className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
            <span className="text-xs text-muted">
              Leave blank for no expiry. First enrollment sets this from the course (BSA/BPV 6 months, BS 1 year, BV/BVA 4
              years).
            </span>
          </label>
          {student.isActive && (
            <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Save details
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
