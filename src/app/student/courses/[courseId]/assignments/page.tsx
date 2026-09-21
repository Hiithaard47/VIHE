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
    include: {
      submissions: {
        where: { studentId: session.user.id },
        orderBy: { attemptNumber: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = assignments.filter((item) => item.submissions.length === 0);
  const submitted = assignments.filter((item) => item.submissions.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <AssignmentGroup
        courseId={courseId}
        title="Pending"
        items={pending}
        empty="No pending assignments."
      />
      <AssignmentGroup
        courseId={courseId}
        title="Submitted"
        items={submitted}
        empty="No submitted assignments yet."
      />
    </div>
  );
}

function AssignmentGroup({
  courseId,
  title,
  items,
  empty,
}: {
  courseId: string;
  title: string;
  items: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    maxMarks: number;
    submissions: Array<{ marks: number | null; attemptNumber: number }>;
  }>;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title} &middot; {items.length}
      </h2>
      {items.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <div className="flex flex-col gap-2">
        {items.map((assignment) => {
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
                {submission && submission.attemptNumber > 1 ? ` · Attempt ${submission.attemptNumber}` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
