import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session) return null;

  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      enrollments: {
        some: { batch: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
      },
    },
    include: {
      enrollments: {
        where: { batch: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
        include: { batch: { include: { course: true } } },
      },
    },
    orderBy: { rollNumber: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold text-ink">Students</h1>
        <p className="text-sm text-muted">Students enrolled in courses you teach.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Courses</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">{student.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {student.enrollments.map((e) => (
                      <span key={e.batchId} className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                        {e.batch.course.name}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No students yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
