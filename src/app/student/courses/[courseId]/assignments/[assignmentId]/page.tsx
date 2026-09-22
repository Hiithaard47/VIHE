import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, isPastDueDate } from "@/lib/time";
import { assignmentStatus, ASSIGNMENT_FILE_ACCEPT } from "@/lib/assignment-files";
import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
import { submitAssignment } from "@/modules/assignments/actions";

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
        orderBy: { attemptNumber: "desc" },
        include: { files: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!assignment) notFound();

  const attempts = assignment.submissions;
  const latest = attempts[0] ?? null;
  const latestGraded = latest?.marks !== null && latest?.marks !== undefined;
  const pastDue = isPastDueDate(assignment.dueDate);
  const canSubmit =
    enrollment.course.isActive && (!latest || latestGraded || !pastDue);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/student/courses/${courseId}/assignments`} className="text-sm text-muted">
          &larr; Assignments
        </Link>
        <h2 className="font-heading text-lg font-semibold text-ink">{assignment.title}</h2>
        <p className="text-sm text-muted">
          {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
          Out of {assignment.maxMarks} · {assignmentStatus(latest)}
          {latest ? ` · Attempt ${latest.attemptNumber}` : ""}
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

      {latestGraded && latest && (
        <section className="rounded-lg border border-hairline bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Marks · Attempt {latest.attemptNumber}
          </h3>
          <p className="mt-2 font-heading text-lg font-semibold text-ink">
            {latest.marks}/{assignment.maxMarks}
          </p>
          {latest.feedback && <p className="mt-1 text-sm text-ink">{latest.feedback}</p>}
        </section>
      )}

      {attempts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Your attempts</h3>
          {attempts.map((attempt) => (
            <div key={attempt.id} className="rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
              <p className="font-medium">
                Attempt {attempt.attemptNumber}
                <span className="ml-2 font-normal text-muted">
                  {formatDisplayDate(attempt.submittedAt)} · {assignmentStatus(attempt)}
                </span>
              </p>
              {attempt.files.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {attempt.files.map((file) => (
                    <li key={file.id}>
                      <a href={`/assignments/submission-files/${file.id}`} className="text-accent-dark hover:underline">
                        {file.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {latest && !latestGraded && pastDue && (
        <p className="text-sm text-muted">
          The due date has passed, so this upload cannot be replaced until it is graded.
        </p>
      )}

      {canSubmit && (
        <form action={submitAssignment.bind(null, courseId, assignment.id)} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {latestGraded
              ? `Submit attempt ${(latest?.attemptNumber ?? 0) + 1}`
              : latest
                ? "Replace your upload"
                : "Upload completed work"}
          </h3>
          {pastDue && !latest && (
            <p className="text-xs text-muted">This is after the due date. You can still submit once.</p>
          )}
          {latest && !latestGraded && !pastDue && (
            <p className="text-xs text-muted">Submitting again keeps your previous attempt and starts a new one.</p>
          )}
          {latestGraded && (
            <p className="text-xs text-muted">Your previous attempt was graded. Submit a new attempt if you need to revise.</p>
          )}
          <label className="flex flex-col gap-1 text-sm text-ink">
            Your files
            <UploadFileInput
              name="files"
              required
              multiple
              accept={ASSIGNMENT_FILE_ACCEPT}
            />
          </label>
          <UploadSubmitButton idleLabel={latest ? "Submit new attempt" : "Submit assignment"} />
        </form>
      )}
    </div>
  );
}
