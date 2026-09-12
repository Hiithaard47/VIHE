import { notFound } from "next/navigation";
import { STATUS_OPTIONS } from "@/lib/attendance";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((option) => [option.value, option.label]));

export default async function AdminStudentAttendancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  await requireAnyPermission([PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.COURSES_MANAGE]);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      attendance: {
        include: {
          session: {
            include: { category: { select: { name: true } }, batch: { include: { course: { select: { name: true } } } } },
          },
        },
        orderBy: { session: { date: "desc" } },
        take: 20,
      },
    },
  });
  if (!student) notFound();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Recent attendance</h2>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {student.attendance.map((record) => (
              <tr key={record.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{formatDisplayDate(record.session.date)}</td>
                <td className="px-4 py-3">
                  {record.session.batch.course.name}
                  <p className="text-xs text-muted">
                    {record.session.category.name} · {record.session.name}
                  </p>
                </td>
                <td className="px-4 py-3">{STATUS_LABELS[record.status] ?? record.status}</td>
              </tr>
            ))}
            {student.attendance.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No attendance marked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
