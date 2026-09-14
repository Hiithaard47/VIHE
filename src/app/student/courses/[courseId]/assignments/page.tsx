import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { assignmentStatus } from "@/lib/assignment-files";

export default async function StudentAssignmentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const assignments = await prisma.assignment.findMany({
    where: { subject: { courseId } },
    include: { submissions: { where: { studentId: session.user.id } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Assignments &middot; {assignments.length}
      </h2>
      {assignments.length === 0 && <p className="text-sm text-muted">No assignments have been issued yet.</p>}
      <div className="flex flex-col gap-2">
        {assignments.map((assignment) => {
          const submission = assignment.submissions[0] ?? null;
          return (
            <Link
              key={assignment.id}
              href={`/student/courses/${courseId}/assignments/${assignment.id}`}
              className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
            >
              <p className="font-medium text-ink">{assignment.title}</p>
              <p className="text-xs text-muted">
                {assignment.dueDate ? `Due ${formatDisplayDate(assignment.dueDate)} · ` : ""}
                {assignmentStatus(submission)}
                {submission?.marks !== null && submission?.marks !== undefined
                  ? ` · ${submission.marks}/${assignment.maxMarks}`
                  : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
