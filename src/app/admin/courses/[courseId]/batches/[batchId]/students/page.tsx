import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPersonDialog } from "@/components/add-person-autocomplete";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { enrollBatchStudent, unenrollBatchStudent } from "../actions";

export default async function AdminBatchStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
}) {
  const { courseId, batchId } = await params;
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const batch = await prisma.courseBatch.findUnique({
    where: { id: batchId },
    select: {
      courseId: true,
      course: { select: { isActive: true } },
      enrollments: {
        include: { student: true },
        orderBy: { student: { rollNumber: "asc" } },
      },
    },
  });
  if (!batch || batch.courseId !== courseId) notFound();
  const enrolledIds = batch.enrollments.map(({ studentId }) => studentId);
  const available = await prisma.student.findMany({
    where: { isActive: true, id: { notIn: enrolledIds } },
    orderBy: { rollNumber: "asc" },
    select: { id: true, name: true, rollNumber: true },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Students &middot; {batch.enrollments.length} student(s)
        </h2>
        {batch.course.isActive && (
          <AddPersonDialog
            people={available.map((student) => ({
              id: student.id,
              title: student.name,
              subtitle: student.rollNumber,
            }))}
            fieldName="studentId"
            buttonLabel="Add student"
            placeholder="Search by name or roll number"
            emptyLabel="No matching students."
            action={enrollBatchStudent.bind(null, courseId, batchId)}
          />
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {batch.enrollments.map(({ student }) => (
              <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/students/${student.id}`} className="font-medium hover:text-accent-dark">
                    {student.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {batch.course.isActive && (
                    <form action={unenrollBatchStudent.bind(null, courseId, batchId)}>
                      <input type="hidden" name="studentId" value={student.id} />
                      <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {batch.enrollments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No students enrolled in this batch yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
