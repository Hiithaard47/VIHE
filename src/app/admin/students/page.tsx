import { prisma } from "@/lib/prisma";
import { FlashBanner } from "@/components/flash-banner";
import {
  createStudent,
  updateStudentEnrollments,
  toggleStudentActive,
  approveApplication,
  rejectApplication,
} from "./actions";

export default async function StudentsPage() {
  const [students, courses, applications] = await Promise.all([
    prisma.student.findMany({
      include: { enrollments: { include: { batch: { include: { course: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      include: { batches: { where: { isActive: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.studentApplication.findMany({
      where: { status: "PENDING" },
      include: { desiredCourse: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const MODE_LABELS = { ONLINE: "Online", HYBRID: "Hybrid", ON_SITE: "On-site" } as const;
  const LANGUAGE_LABELS = { ENGLISH: "English", HINDI: "Hindi" } as const;

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      {applications.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Applications ({applications.length})
          </h2>
          <div className="flex flex-col gap-3">
            {applications.map((application) => (
              <div key={application.id} className="rounded-lg border border-hairline bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-lg">
                    <p className="font-heading font-medium text-ink">{application.name}</p>
                    <p className="text-xs text-muted">{application.email}</p>
                    {application.phone && <p className="text-xs text-muted">{application.phone}</p>}
                    {(application.city || application.country) && (
                      <p className="text-xs text-muted">
                        {[application.city, application.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {application.dateOfBirth && (
                      <p className="text-xs text-muted">
                        Born {application.dateOfBirth.toLocaleDateString()}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {application.desiredCourse && (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-accent-dark">
                          {application.desiredCourse.name}
                        </span>
                      )}
                      {application.preferredMode && (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                          {MODE_LABELS[application.preferredMode]}
                        </span>
                      )}
                      {application.preferredLanguage && (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                          {LANGUAGE_LABELS[application.preferredLanguage]}
                        </span>
                      )}
                    </div>

                    {application.priorExperience && (
                      <p className="mt-2 text-sm text-ink">
                        <span className="text-xs font-medium text-muted">Prior experience: </span>
                        {application.priorExperience}
                      </p>
                    )}
                    {application.message && <p className="mt-2 text-sm text-ink">{application.message}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <form action={approveApplication.bind(null, application.id)} className="flex items-center gap-2">
                      <input
                        name="rollNumber"
                        placeholder="Assign roll no."
                        required
                        className="w-32 rounded-md border border-hairline bg-input px-2 py-1.5 text-xs text-ink placeholder:text-muted"
                      />
                      <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-accent">
                        Approve
                      </button>
                    </form>
                    <form action={rejectApplication.bind(null, application.id)}>
                      <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Add student</h2>
        <form action={createStudent} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input name="name" placeholder="Full name" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="rollNumber" placeholder="Roll number (unique)" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
            <input name="email" type="email" placeholder="Email (optional)" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted" />
          </div>
          <fieldset className="flex flex-wrap gap-4 text-sm text-ink">
            <legend className="mb-1 w-full text-muted">Enroll in course batches</legend>
            {courses.map((course) => (
              <label key={course.id} className="flex items-center gap-1.5">
                <span>{course.name}</span>
                <select
                  name={`batch-${course.id}`}
                  defaultValue=""
                  className="rounded-md border border-hairline bg-input px-2 py-1.5 text-xs text-ink"
                >
                  <option value="">Not enrolled</option>
                  {course.batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Add student
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Students</h2>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Enrolled courses</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const enrolledBatches = new Map(
                  student.enrollments.map((enrollment) => [enrollment.batch.courseId, enrollment.batchId]),
                );
                return (
                  <tr key={student.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-heading font-medium">{student.name}</p>
                      <p className="text-xs text-muted">{student.rollNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateStudentEnrollments.bind(null, student.id)} className="flex flex-wrap items-center gap-2">
                        {courses.map((course) => (
                          <label key={course.id} className="flex items-center gap-1 text-xs">
                            <span>{course.name}</span>
                            <select
                              name={`batch-${course.id}`}
                              defaultValue={enrolledBatches.get(course.id) ?? ""}
                              className="rounded-md border border-hairline bg-input px-2 py-1 text-xs text-ink"
                            >
                              <option value="">Not enrolled</option>
                              {course.batches.map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                  {batch.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                        <button type="submit" className="rounded-md border border-hairline px-2 py-1 text-xs text-ink hover:bg-canvas">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <span className={student.isActive ? "text-emerald-700" : "text-muted"}>
                        {student.isActive ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleStudentActive.bind(null, student.id)}>
                        <input type="hidden" name="nextActive" value={(!student.isActive).toString()} />
                        <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                          {student.isActive ? "Deactivate" : "Reactivate"}
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
