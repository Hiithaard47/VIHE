import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCourseAccess } from "@/lib/rbac";
import { FlashBanner } from "@/components/flash-banner";
import { relativeTimeFromNow } from "@/lib/time";
import { markAttendance } from "./actions";
import { AttendanceForm } from "./attendance-form";

export default async function SessionAttendancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        select: {
          id: true,
          name: true,
          defaultStatus: true,
          enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
        },
      },
      records: { include: { markedBy: { select: { name: true } } } },
    },
  });
  if (!classSession) notFound();

  await requireCourseAccess(classSession.courseId);

  const recordByStudent = new Map(classSession.records.map((r) => [r.studentId, r]));

  const students = classSession.course.enrollments.map(({ student }) => ({
    id: student.id,
    rollNumber: student.rollNumber,
    name: student.name,
    status: recordByStudent.get(student.id)?.status ?? classSession.course.defaultStatus,
  }));

  const lastSaved = classSession.records.reduce<(typeof classSession.records)[number] | null>(
    (latest, record) => (!latest || record.markedAt > latest.markedAt ? record : latest),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <FlashBanner />
      <div>
        <Link href={`/teacher/courses/${classSession.courseId}`} className="text-sm text-muted">
          &larr; {classSession.course.name}
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{new Date(classSession.date).toLocaleDateString()}</h1>
        {classSession.topic && <p className="text-sm text-muted">{classSession.topic}</p>}
        {lastSaved && (
          <p className="mt-1 text-xs text-muted">
            Last saved {relativeTimeFromNow(lastSaved.markedAt)} by {lastSaved.markedBy.name}
          </p>
        )}
      </div>

      <AttendanceForm action={markAttendance.bind(null, sessionId)} students={students} />
    </div>
  );
}
