import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessionWhere } from "@/lib/batch-scope";
import { loadCourseWorkspace } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { assignmentStatus } from "@/lib/assignment-files";
import { deleteAssignment, gradeSubmission } from "@/app/teacher/courses/[courseId]/assignments/actions";
import { courseHref, firstTeacherCoursePath, type CoursePortal } from "@/lib/course-workspace";
import { hasCoursesRead } from "@/lib/permissions";

export async function CourseAssignmentDetailView({
  courseId,
  assignmentId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  assignmentId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const { session, scope, canManage } = await loadCourseWorkspace(courseId, portal, selectedBatchId);
  if (portal === "teacher" && !hasCoursesRead(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, ...sessionWhere(courseId, scope) },
    include: {
      batch: {
        include: {
          enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
        },
      },
      submissions: true,
    },
  });
  if (!assignment) notFound();

  const submissionByStudent = new Map(assignment.submissions.map((item) => [item.studentId, item]));
  const listHref = courseHref(portal, courseId, "assignments", selectedBatchId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={listHref} className="text-sm text-muted">
          &larr; Assignments
        </Link>
        <h2 className="font-heading text-lg font-semibold text-ink">{assignment.title}</h2>
        <p className="text-sm text-muted">
          {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
          Out of {assignment.maxMarks}
        </p>
        {assignment.instructions && <p className="mt-2 text-sm text-ink">{assignment.instructions}</p>}
        <p className="mt-2 text-sm">
          <a href={`/assignments/${assignment.id}/file`} className="font-medium text-accent-dark hover:underline">
            {assignment.fileName}
          </a>
        </p>
        {canManage && (
          <form action={deleteAssignment.bind(null, courseId, assignment.id, portal)} className="mt-3">
            <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
              Remove assignment
            </button>
          </form>
        )}
      </div>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Submissions &middot; {assignment.batch.enrollments.length} student(s)
        </h3>
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Work</th>
                <th className="px-4 py-2 font-medium">Marks</th>
              </tr>
            </thead>
            <tbody>
              {assignment.batch.enrollments.map(({ student }) => {
                const submission = submissionByStudent.get(student.id);
                return (
                  <tr key={student.id} className="border-b border-hairline text-ink last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p>{student.name}</p>
                      <p className="text-xs text-muted">{student.rollNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{assignmentStatus(submission ?? null)}</td>
                    <td className="px-4 py-3">
                      {submission ? (
                        <a href={`/assignments/submissions/${submission.id}/file`} className="hover:text-accent-dark">
                          {submission.fileName}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && submission ? (
                        <form
                          action={gradeSubmission.bind(null, courseId, assignment.id, student.id, portal)}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center"
                        >
                          <input
                            name="marks"
                            type="number"
                            min={0}
                            max={assignment.maxMarks}
                            required
                            defaultValue={submission.marks ?? ""}
                            className="w-20 rounded-md border border-hairline bg-input px-2 py-1.5 text-sm text-ink"
                          />
                          <input
                            name="feedback"
                            placeholder="Comment"
                            defaultValue={submission.feedback ?? ""}
                            className="min-w-32 flex-1 rounded-md border border-hairline bg-input px-2 py-1.5 text-sm text-ink placeholder:text-muted"
                          />
                          <button type="submit" className="text-xs font-semibold text-accent-dark underline">
                            Save
                          </button>
                        </form>
                      ) : submission?.marks !== null && submission?.marks !== undefined ? (
                        <span>
                          {submission.marks}/{assignment.maxMarks}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {assignment.batch.enrollments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-muted">
                    No students enrolled in this batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
