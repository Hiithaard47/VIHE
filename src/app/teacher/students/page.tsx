import { ListSearch } from "@/components/list-search";
import { containsInsensitive, parseAdminListSearch } from "@/lib/admin-list";
import { hasStudentsRead, TEACHER_PORTAL_PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";

const PATH = "/teacher/students";

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireAnyPermission(TEACHER_PORTAL_PERMISSIONS);
  if (!hasStudentsRead(session.user.permissions)) redirect("/teacher");

  const { q: rawQ } = await searchParams;
  const q = parseAdminListSearch(rawQ);
  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      enrollments: {
        some: {
          course: {
            isActive: true,
            subjects: { some: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
          },
        },
      },
      ...(q ? containsInsensitive(q, ["name", "rollNumber", "email", "phone"]) : {}),
    },
    include: {
      enrollments: {
        where: {
          course: {
            isActive: true,
            subjects: { some: { isActive: true, teachers: { some: { teacherId: session.user.id } } } },
          },
        },
        include: { course: true },
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
              <th className="px-3 py-2 font-medium sm:px-4">Roll no.</th>
              <th className="px-3 py-2 font-medium sm:px-4">Name</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Email</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Mobile</th>
              <th className="px-3 py-2 font-medium sm:px-4">Courses</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                <td className="px-3 py-3 sm:px-4">{student.rollNumber}</td>
                <td className="px-3 py-3 sm:px-4">
                  {student.name}
                  <p className="text-xs text-muted sm:hidden">
                    {[student.email, student.phone].filter(Boolean).join(" · ") || "No contact"}
                  </p>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{student.email || "—"}</td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{student.phone || "—"}</td>
                <td className="px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap gap-1">
                    {student.enrollments.map((e) => (
                      <span key={e.courseId} className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                        {e.course.name}
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
