import { auth } from "@/auth";
import { ListSearch } from "@/components/list-search";
import { containsInsensitive, parseAdminListSearch } from "@/lib/admin-list";
import { prisma } from "@/lib/prisma";

const PATH = "/teacher/students";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const { q: rawQ } = await searchParams;
  const q = parseAdminListSearch(rawQ);
  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      enrollments: {
        some: { batch: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
      },
      ...(q ? containsInsensitive(q, ["name", "rollNumber", "email", "phone"]) : {}),
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

      <ListSearch action={PATH} tab="active" q={q} placeholder="Search by name, roll number, email, or mobile" />

      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Mobile</th>
              <th className="px-4 py-2 font-medium">Courses</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">{student.name}</td>
                <td className="px-4 py-3 text-muted">{student.email || "—"}</td>
                <td className="px-4 py-3 text-muted">{student.phone || "—"}</td>
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
                <td colSpan={5} className="px-4 py-3 text-sm text-muted">
                  {q ? "No matching students." : "No students yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
