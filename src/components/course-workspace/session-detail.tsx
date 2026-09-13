import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageBatch, requireBatchView } from "@/lib/rbac";
import { FlashBanner } from "@/components/flash-banner";
import { SessionActionsMenu } from "@/components/session-actions-menu";
import { PERMISSIONS } from "@/lib/permissions";
import { STATUS_OPTIONS } from "@/lib/attendance";
import { formatTime } from "@/lib/schedule";
import { formatDisplayDate, isFutureSessionDate, relativeTimeFromNow } from "@/lib/time";
import { SessionResources } from "@/components/session-resources";
import { markAttendance } from "@/app/sessions/actions";
import { AttendanceForm } from "@/app/teacher/sessions/[sessionId]/attendance-form";
import { courseHref, sessionHref, type CoursePortal } from "@/lib/course-workspace";

export async function SessionDetailView({
  sessionId,
  portal,
}: {
  sessionId: string;
  portal: CoursePortal;
}) {
  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      category: { select: { name: true, allowsResources: true } },
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

  const session = await requireBatchView(classSession.batch.id, portal);
  const canManage = await canManageBatch(session, classSession.batch.id);
  const canManageSession = canManage && session.user.permissions.includes(PERMISSIONS.SESSIONS_MANAGE);
  const canChangeDate = canManageSession && isFutureSessionDate(classSession.date);
  const canRemove = canManageSession && classSession.records.length === 0;

  const recordByStudent = new Map(classSession.records.map((record) => [record.studentId, record]));
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
  const selfHref = sessionHref(portal, sessionId);

  return (
    <div className="flex flex-col gap-6">
      <FlashBanner />
      <div>
        <Link href={courseHref(portal, classSession.batch.course.id, "", classSession.batch.id)} className="text-sm text-muted">
          &larr; {classSession.batch.course.name}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold text-ink">{classSession.name}</h1>
            <p className="text-sm text-muted">
              {classSession.category.name} · {formatDisplayDate(classSession.date)}
              {classSession.startMinute != null && classSession.endMinute != null
                ? ` · ${formatTime(classSession.startMinute)}–${formatTime(classSession.endMinute)}`
                : ""}
            </p>
          </div>
          {(canChangeDate || canRemove) && (
            <SessionActionsMenu
              sessionId={sessionId}
              date={classSession.date.toISOString()}
              startMinute={classSession.startMinute}
              endMinute={classSession.endMinute}
              returnTo={selfHref}
              deleteReturnTo={courseHref(portal, classSession.batch.course.id, "", classSession.batch.id)}
              canChangeDate={canChangeDate}
              canRemove={canRemove}
              portal={portal}
            />
          )}
        </div>
        {lastSaved && (
          <p className="mt-1 text-xs text-muted">
            Last saved {relativeTimeFromNow(lastSaved.markedAt)} by {lastSaved.markedBy.name}
          </p>
        )}
      </div>

      {classSession.category.allowsResources && (
        <SessionResources
          sessionId={sessionId}
          resources={classSession.resources}
          canManage={canManage}
          portal={portal}
        />
      )}
      {canManage ? (
        <AttendanceForm action={markAttendance.bind(null, sessionId, portal)} students={students} />
      ) : (
        <section className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Roll no.</th>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">{student.rollNumber}</td>
                  <td className="px-4 py-3">{student.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {STATUS_OPTIONS.find((option) => option.value === student.status)?.label ?? student.status}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                    No students enrolled in this batch yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
