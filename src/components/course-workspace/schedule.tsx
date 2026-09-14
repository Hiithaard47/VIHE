import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { subjectWhere, resolveWorkspaceScope } from "@/lib/subject-scope";
import { requireCourseConfigure } from "@/lib/rbac";
import { scheduleHref, type CoursePortal } from "@/lib/course-workspace";
import { mondayOf } from "@/lib/schedule";
import { startOfTodayUtc, toDateInputValue } from "@/lib/time";
import { ScheduleEditor } from "@/components/course-workspace/schedule-editor";

export async function CourseScheduleView({
  courseId,
  portal,
  selectedSubjectId,
}: {
  courseId: string;
  portal: CoursePortal;
  selectedSubjectId?: string;
}) {
  const session = await requireCourseConfigure(courseId, portal);
  const scope = await resolveWorkspaceScope(session, courseId, selectedSubjectId);
  if (!scope) notFound();

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        subjects: {
          where: subjectWhere(scope),
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

  const subject =
    course.subjects.find((item) => item.id === selectedSubjectId) ?? course.subjects[0];
  if (!subject) {
    return <p className="text-sm text-muted">Assign a subject before setting a schedule.</p>;
  }

  const termStart = subject.termStart ? mondayOf(subject.termStart) : mondayOf(startOfTodayUtc());

  return (
    <ScheduleEditor
      courseId={courseId}
      portal={portal}
      subjectName={subject.name}
      subjects={[{ id: subject.id, name: subject.name }]}
      categories={categories}
      initialTermStart={toDateInputValue(termStart)}
      initialWeekCount={subject.weekCount ?? 16}
      sessions={subject.sessions.map((item) => ({
        id: item.id,
        date: toDateInputValue(item.date),
        name: item.name,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        markedCount: item._count.records,
      }))}
      returnTo={scheduleHref(portal, courseId, subject.id)}
    />
  );
}
