import { notFound } from "next/navigation";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, sessionTiming } from "@/lib/time";

const TIMING_LABEL = { upcoming: "Upcoming", today: "Today", past: "Previous" } as const;

export default async function StudentCourseSessionsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const sessions = await prisma.classSession.findMany({
    where: { batchId: enrollment.batch.id },
    orderBy: { date: "asc" },
    select: { id: true, date: true, name: true, category: { select: { name: true } } },
  });
  const upcoming = sessions.filter((item) => sessionTiming(item.date) !== "past");
  const previous = sessions.filter((item) => sessionTiming(item.date) === "past").reverse();

  return (
    <div className="flex flex-col gap-6">
      <SessionGroup title="Upcoming" sessions={upcoming} empty="No upcoming sessions." />
      <SessionGroup title="Previous" sessions={previous} empty="No previous sessions." />
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  empty,
}: {
  title: string;
  sessions: Array<{ id: string; date: Date; name: string; category: { name: string } }>;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title} &middot; {sessions.length}
      </h2>
      {sessions.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <div className="flex flex-col gap-2">
        {sessions.map((item) => (
          <div key={item.id} className="rounded-lg border border-hairline bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.category.name} · {formatDisplayDate(item.date)}
                </p>
              </div>
              <span className="text-xs text-muted">{TIMING_LABEL[sessionTiming(item.date)]}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
