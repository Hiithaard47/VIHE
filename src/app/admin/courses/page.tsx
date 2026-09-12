import { prisma } from "@/lib/prisma";
import { FlashBanner } from "@/components/flash-banner";
import { createCourse, updateCourseTeachers, toggleCourseActive } from "./actions";

export default async function CoursesPage() {
  const [courses, teachers] = await Promise.all([
    prisma.course.findMany({
      include: { teachers: { include: { teacher: true } }, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add course</h2>
        <form action={createCourse} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input name="name" placeholder="Course name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="code" placeholder="Course code (unique)" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="description" placeholder="Description (optional)" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm text-ink">
            <legend className="mb-1 text-muted">Teachers</legend>
            {teachers.map((teacher) => (
              <label key={teacher.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="teacherIds" value={teacher.id} />
                {teacher.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Create course
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Courses</h2>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Teachers</th>
                <th className="px-4 py-2 font-medium">Students</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const assignedIds = new Set(course.teachers.map((t) => t.teacherId));
                return (
                  <tr key={course.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-heading font-medium">{course.name}</p>
                      <p className="text-xs text-muted">{course.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateCourseTeachers.bind(null, course.id)} className="flex flex-wrap items-center gap-2">
                        {teachers.map((teacher) => (
                          <label key={teacher.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              name="teacherIds"
                              value={teacher.id}
                              defaultChecked={assignedIds.has(teacher.id)}
                            />
                            {teacher.name}
                          </label>
                        ))}
                        <button type="submit" className="rounded-md border border-hairline px-2 py-1 text-xs text-ink hover:bg-canvas">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">{course._count.enrollments}</td>
                    <td className="px-4 py-3">
                      <span className={course.isActive ? "text-emerald-700" : "text-muted"}>
                        {course.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleCourseActive.bind(null, course.id)}>
                        <input type="hidden" name="nextActive" value={(!course.isActive).toString()} />
                        <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                          {course.isActive ? "Archive" : "Restore"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
