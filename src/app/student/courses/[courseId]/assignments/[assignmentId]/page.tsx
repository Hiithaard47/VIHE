import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, isPastDueDate } from "@/lib/time";
import { assignmentStatus } from "@/lib/assignment-files";
import { submitAssignment } from "../actions";

export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    include: { submissions: { where: { studentId: session.user.id } } },
  });
  if (!assignment) notFound();

  const submission = assignment.submissions[0] ?? null;
  const graded = submission?.marks !== null && submission?.marks !== undefined;
  const pastDue = isPastDueDate(assignment.dueDate);
  const canSubmit = enrollment.course.isActive && !graded && !(submission && pastDue);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/student/courses/${courseId}/assignments`} className="text-sm text-muted">
          &larr; Assignments
        </Link>
        <h2 className="font-heading text-lg font-semibold text-ink">{assignment.title}</h2>
        <p className="text-sm text-muted">
          {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
          Out of {assignment.maxMarks} · {assignmentStatus(submission)}
        </p>
        {assignment.instructions && <p className="mt-2 text-sm text-ink">{assignment.instructions}</p>}
        <p className="mt-2 text-sm">
          <a href={`/assignments/${assignment.id}/file`} className="font-medium text-accent-dark hover:underline">
            Download assignment test · {assignment.fileName}
          </a>
        </p>
      </div>

      {graded && (
        <section className="rounded-lg border border-hairline bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Marks</h3>
          <p className="mt-2 font-heading text-lg font-semibold text-ink">
            {submission.marks}/{assignment.maxMarks}
          </p>
          {submission.feedback && <p className="mt-1 text-sm text-ink">{submission.feedback}</p>}
        </section>
      )}

      {submission && (
        <p className="text-sm text-ink">
          Your upload:{" "}
          <a href={`/assignments/submissions/${submission.id}/file`} className="text-accent-dark hover:underline">
            {submission.fileName}
          </a>
        </p>
      )}

      {submission && pastDue && !graded && (
        <p className="text-sm text-muted">The due date has passed, so this upload cannot be replaced.</p>
      )}

      {canSubmit && (
        <form action={submitAssignment.bind(null, courseId, assignment.id)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {submission ? "Replace your upload" : "Upload completed work"}
          </h3>
          {pastDue && !submission && (
            <p className="text-xs text-muted">This is after the due date. You can still submit once.</p>
          )}
          <label className="flex flex-col gap-1 text-sm text-ink">
            PDF or image
            <input
              name="file"
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
            Submit assignment
          </button>
        </form>
      )}
    </div>
  );
}
