import Link from "next/link";
import { notFound } from "next/navigation";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/rbac";
import { formatDisplayDate, sessionTiming } from "@/lib/time";
import { formatTime } from "@/lib/schedule";
import { StudentSessionHomework } from "@/modules/session-homework";

export default async function StudentSessionDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; sessionId: string }>;
}) {
  const { courseId, sessionId } = await params;
  const auth = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(auth.user.id, courseId);
  if (!enrollment) notFound();

  const classSession = await prisma.classSession.findFirst({
    where: { id: sessionId, subject: { courseId } },
    select: {
      id: true,
      name: true,
      date: true,
      startMinute: true,
      endMinute: true,
      category: { select: { name: true } },
      homework: {
        select: {
          id: true,
          title: true,
          instructions: true,
          submissions: {
            where: { studentId: auth.user.id },
            take: 1,
            include: {
              files: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true } },
            },
          },
        },
      },
      resources: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, contentType: true },
      },
    },
  });
  if (!classSession) notFound();

  const timing = sessionTiming(classSession.date);
  const homework = classSession.homework;
  const submission = homework?.submissions[0] ?? null;
  const canSubmit = Boolean(homework && enrollment.course.isActive && timing === "today");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={
            homework
              ? `/student/courses/${courseId}/homework`
              : `/student/courses/${courseId}`
          }
          className="text-sm text-muted"
        >
          &larr; {homework ? "Homework" : "Sessions"}
        </Link>
        <h2 className="font-heading text-lg font-semibold text-ink">{classSession.name}</h2>
        <p className="text-sm text-muted">
          {classSession.category.name} · {formatDisplayDate(classSession.date)}
          {classSession.startMinute != null && classSession.endMinute != null
            ? ` · ${formatTime(classSession.startMinute)}–${formatTime(classSession.endMinute)}`
            : ""}
        </p>
      </div>

      {classSession.resources.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Resources</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {classSession.resources.map((resource) => (
              <li key={resource.id}>
                <a href={`/resources/${resource.id}`} className="font-medium text-accent-dark hover:underline">
                  {resource.fileName}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {homework ? (
        <StudentSessionHomework
          courseId={courseId}
          sessionId={sessionId}
          homework={homework}
          submission={
            submission
              ? { files: submission.files, submittedAt: submission.submittedAt }
              : null
          }
          canSubmit={canSubmit}
          courseActive={enrollment.course.isActive}
        />
      ) : (
        <p className="text-sm text-muted">No homework for this session.</p>
      )}
    </div>
  );
}
