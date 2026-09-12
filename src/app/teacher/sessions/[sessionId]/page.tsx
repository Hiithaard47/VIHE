import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBatchAccess } from "@/lib/rbac";
import { FlashBanner } from "@/components/flash-banner";
import { SessionActionsMenu } from "@/components/session-actions-menu";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDisplayDate, isFutureSessionDate, relativeTimeFromNow } from "@/lib/time";
import { SessionResources } from "@/components/session-resources";
import { markAttendance } from "./actions";
import { AttendanceForm } from "./attendance-form";

export default async function SessionAttendancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      batch: {
        select: {
          id: true,
          course: { select: { id: true, name: true, defaultStatus: true } },
          enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
        },
      },
      records: { include: { markedBy: { select: { name: true } } } },
      resources: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
    },
  });
  if (!classSession) notFound();

  const session = await requireBatchAccess(classSession.batch.id);
  const canChangeDate =
    session.user.permissions.includes(PERMISSIONS.SESSIONS_MANAGE) && isFutureSessionDate(classSession.date);

  const recordByStudent = new Map(classSession.records.map((r) => [r.studentId, r]));

  const students = classSession.batch.enrollments.map(({ student }) => ({
    id: student.id,
    rollNumber: student.rollNumber,
    name: student.name,
    email: student.email,
    phone: student.phone,
    status: recordByStudent.get(student.id)?.status ?? classSession.batch.course.defaultStatus,
  }));

  const lastSaved = classSession.records.reduce<(typeof classSession.records)[number] | null>(
    (latest, record) => (!latest || record.markedAt > latest.markedAt ? record : latest),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <FlashBanner />
      <div>
        <Link href={`/teacher/courses/${classSession.batch.course.id}`} className="text-sm text-muted">
          &larr; {classSession.batch.course.name}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold text-ink">{formatDisplayDate(classSession.date)}</h1>
            {classSession.topic && <p className="text-sm text-muted">{classSession.topic}</p>}
          </div>
          {canChangeDate && (
            <SessionActionsMenu
              sessionId={sessionId}
              date={classSession.date.toISOString()}
              returnTo={`/teacher/sessions/${sessionId}`}
              canChangeDate
            />
          )}
        </div>
        {lastSaved && (
          <p className="mt-1 text-xs text-muted">
            Last saved {relativeTimeFromNow(lastSaved.markedAt)} by {lastSaved.markedBy.name}
          </p>
        )}
      </div>

      <SessionResources sessionId={sessionId} resources={classSession.resources} canManage />
      <AttendanceForm action={markAttendance.bind(null, sessionId)} students={students} />
    </div>
  );
}
