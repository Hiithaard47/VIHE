import Link from "next/link";
import { notFound } from "next/navigation";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, sessionTiming } from "@/lib/time";

export default async function StudentHomeworkPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const homeworks = await prisma.sessionHomework.findMany({
    where: { session: { subject: { courseId } } },
    include: {
      session: { select: { id: true, name: true, date: true } },
      submissions: {
        where: { studentId: session.user.id },
        take: 1,
        select: { id: true, submittedAt: true },
      },
    },
    orderBy: { session: { date: "desc" } },
  });

  const pending = homeworks.filter((item) => item.submissions.length === 0);
  const submitted = homeworks.filter((item) => item.submissions.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <HomeworkGroup
        courseId={courseId}
        title="Pending"
        items={pending}
        empty="No pending homework."
      />
      <HomeworkGroup
        courseId={courseId}
        title="Submitted"
        items={submitted}
        empty="No submitted homework yet."
      />
    </div>
  );
}

function HomeworkGroup({
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
    session: { id: string; name: string; date: Date };
    submissions: Array<{ submittedAt: Date }>;
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
        {items.map((item) => {
          const timing = sessionTiming(item.session.date);
          const submission = item.submissions[0] ?? null;
          const status =
            submission
              ? `Submitted ${formatDisplayDate(submission.submittedAt)}`
              : timing === "today"
                ? "Due today · Open to submit"
                : timing === "upcoming"
                  ? "Upcoming"
                  : "Missed · session day passed";
          return (
            <Link
              key={item.id}
              href={`/student/courses/${courseId}/sessions/${item.session.id}`}
              className="rounded-lg border border-hairline bg-card p-4 hover:border-accent-dark"
            >
              <p className="font-medium text-ink">{item.title}</p>
              <p className="text-xs text-muted">
                {item.session.name} · {formatDisplayDate(item.session.date)} · {status}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
