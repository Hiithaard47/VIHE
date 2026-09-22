import Link from "next/link";
import { redirect } from "next/navigation";
import { loadCourseWorkspace } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { createAssignment } from "../actions";
import { getCourseAssignmentsList, getWritableSubjects } from "../service/queries";
import { SubjectField } from "@/components/course-workspace-fields";
import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
import { courseHref, firstTeacherCoursePath, type CoursePortal } from "@/lib/course-workspace";
import { ASSIGNMENT_FILE_ACCEPT } from "@/lib/assignment-files";
import { hasCoursesRead, hasWorkspaceWrite } from "@/lib/permissions";

export async function CourseAssignmentsView({
  courseId,
  portal,
  selectedSubjectId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedSubjectId?: string;
}) {
  const { session, scope, canManage } = await loadCourseWorkspace(courseId, portal, selectedSubjectId);
  const canWrite = canManage && hasWorkspaceWrite(session.user.permissions);
  if (portal === "teacher" && !hasCoursesRead(session.user.permissions)) {
    redirect(firstTeacherCoursePath(courseId, session.user.permissions));
  }

  const [{ assignments, enrollmentCount }, writableSubjects] = await Promise.all([
    getCourseAssignmentsList(courseId, scope),
    getWritableSubjects(courseId, scope),
  ]);
  const showSubjectName = new Set(assignments.map((item) => item.subject.name)).size > 1;

  return (
    <div className="flex flex-col gap-6">
      {canWrite && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Issue assignment</h2>
          <form action={createAssignment.bind(null, courseId, portal)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
            <SubjectField subjects={writableSubjects} />
            <label className="flex flex-col gap-1 text-sm text-ink">
              Title
              <input name="title" required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Due date (optional)
                <input type="date" name="dueDate" className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Maximum marks
                <input name="maxMarks" type="number" min={1} defaultValue={100} required className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Instructions (optional)
              <textarea name="instructions" rows={3} className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Assignment files
              <UploadFileInput
                name="files"
                required
                multiple
                accept={ASSIGNMENT_FILE_ACCEPT}
              />
            </label>
            <UploadSubmitButton idleLabel="Issue assignment" />
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Assignments &middot; {assignments.length}
        </h2>
        <div className="flex flex-col gap-2">
          {assignments.length === 0 && <p className="text-sm text-muted">No assignments issued yet.</p>}
          {assignments.map((assignment) => {
            const latestByStudent = new Map<string, (typeof assignment.submissions)[number]>();
            for (const item of assignment.submissions) {
              const current = latestByStudent.get(item.studentId);
              if (!current || item.attemptNumber > current.attemptNumber) {
                latestByStudent.set(item.studentId, item);
              }
            }
            const submitted = latestByStudent.size;
            const graded = [...latestByStudent.values()].filter((item) => item.marks !== null).length;
            return (
              <Link
                key={assignment.id}
                href={courseHref(portal, courseId, `assignments/${assignment.id}`, selectedSubjectId)}
                className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
              >
                <p className="font-medium text-ink">{assignment.title}</p>
                <p className="text-xs text-muted">
                  {showSubjectName ? `${assignment.subject.name} · ` : ""}
                  {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
                  {submitted}/{enrollmentCount} submitted · {graded} graded
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
