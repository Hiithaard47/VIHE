import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseConfigure } from "@/lib/rbac";
import { resolveTeacherBatchesForCourse } from "@/lib/enrollment";
import { scheduleHref, type CoursePortal } from "@/lib/course-workspace";
import { mondayOf } from "@/lib/schedule";
import { startOfTodayUtc, toDateInputValue } from "@/lib/time";
import { ScheduleEditor } from "@/components/course-workspace/schedule-editor";

export async function CourseScheduleView({
  courseId,
  portal,
  selectedBatchId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedBatchId?: string;
}) {
  const session = await requireCourseConfigure(courseId, portal);
  const assignedIds = await resolveTeacherBatchesForCourse(session.user.id, courseId);

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        batches: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            termStart: true,
            weekCount: true,
            sessions: {
              select: {
                id: true,
                date: true,
                name: true,
                startMinute: true,
                endMinute: true,
                categoryId: true,
                category: { select: { name: true } },
                _count: { select: { records: true } },
              },
            },
          },
        },
      },
    }),
    prisma.sessionCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!course) notFound();

  const visible = course.batches.filter((batch) => assignedIds.length === 0 || assignedIds.includes(batch.id));
  const batch = visible.find((item) => item.id === selectedBatchId) ?? visible[0];
  if (!batch) {
    return <p className="text-sm text-muted">Assign a batch before setting a schedule.</p>;
  }

  const termStart = batch.termStart ? mondayOf(batch.termStart) : mondayOf(startOfTodayUtc());

  return (
    <div className="flex flex-col gap-4">
      {visible.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Batches">
          {visible.map((item) => {
            const active = item.id === batch.id;
            return (
              <Link
                key={item.id}
                href={scheduleHref(portal, courseId, undefined, item.id)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-ink font-semibold text-accent" : "border border-hairline text-muted hover:text-ink"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      )}
    <ScheduleEditor
      courseId={courseId}
      portal={portal}
      batchName={batch.name}
      batches={[{ id: batch.id, name: batch.name }]}
      categories={categories}
      initialTermStart={toDateInputValue(termStart)}
      initialWeekCount={batch.weekCount ?? 16}
      sessions={batch.sessions.map((item) => ({
        id: item.id,
        date: toDateInputValue(item.date),
        name: item.name,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        markedCount: item._count.records,
      }))}
      returnTo={scheduleHref(portal, courseId, undefined, batch.id)}
    />
    </div>
  );
}
