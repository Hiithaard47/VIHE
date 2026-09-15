import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, isPastDueDate } from "@/lib/time";
import { assignmentStatus } from "@/lib/assignment-files";
import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
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
    include: {
      files: { orderBy: { createdAt: "asc" } },
      submissions: {
        where: { studentId: session.user.id },
        include: { files: { orderBy: { createdAt: "asc" } } },
      },
    },
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
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {assignment.files.map((file) => (
            <li key={file.id}>
              <a href={`/assignments/files/${file.id}`} className="font-medium text-accent-dark hover:underline">
                Download · {file.fileName}
              </a>
            </li>
          ))}
        </ul>
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

      {submission && submission.files.length > 0 && (
        <div className="text-sm text-ink">
          <p className="mb-1">Your upload{submission.files.length === 1 ? "" : "s"}:</p>
          <ul className="flex flex-col gap-1">
            {submission.files.map((file) => (
              <li key={file.id}>
                <a href={`/assignments/submission-files/${file.id}`} className="text-accent-dark hover:underline">
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
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
            Your files
            <UploadFileInput
              name="files"
              required
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            />
          </label>
          <UploadSubmitButton idleLabel="Submit assignment" />
        </form>
      )}
    </div>
  );
}
