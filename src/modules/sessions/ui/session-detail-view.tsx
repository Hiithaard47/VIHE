import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageSubject, requireSubjectView } from "@/lib/rbac";
import { FlashBanner } from "@/components/flash-banner";
import { SessionActionsMenu } from "@/modules/sessions/ui/session-actions-menu";
import { hasWorkspaceWrite, canManagePastSessionDates, PERMISSIONS } from "@/lib/permissions";
import { STATUS_OPTIONS } from "@/modules/attendance/service/policy";
import { markAttendance } from "@/modules/attendance/actions";
import { AttendanceForm } from "@/modules/attendance/ui/attendance-form";
import { formatTime } from "@/modules/schedule/service/schedule";
import { formatDisplayDate, isFutureSessionDate, relativeTimeFromNow } from "@/lib/time";
import { SessionResources } from "@/modules/session-resources/ui/session-resources";
import { SessionHomeworkPanel } from "@/modules/session-homework";
import { courseHref, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import { getSessionDetail, getSessionSubjectId } from "@/modules/sessions/service/queries";

export async function SessionDetailView({
  sessionId,
  portal,
}: {
  sessionId: string;
  portal: CoursePortal;
}) {
  const subjectId = await getSessionSubjectId(sessionId);
  if (!subjectId) notFound();
  const session = await requireSubjectView(subjectId, portal);

  const classSession = await getSessionDetail(sessionId);
  if (!classSession) notFound();

  const canManage = await canManageSubject(session, classSession.subject.id);
  const canManageSession = canManage && session.user.permissions.includes(PERMISSIONS.SESSIONS_MANAGE);
  const canMarkAttendance = canManage && session.user.permissions.includes(PERMISSIONS.ATTENDANCE_MARK);
  const canManagePastDates = canManagePastSessionDates(session.user.permissions, portal);
  const canChangeDate = canManageSession && (canManagePastDates || isFutureSessionDate(classSession.date));
  const canRemove = canManageSession && classSession.records.length === 0;

  const recordByStudent = new Map(classSession.records.map((record) => [record.studentId, record]));
  const students = classSession.subject.course.enrollments.map(({ student }) => ({
    id: student.id,
    rollNumber: student.rollNumber,
    name: student.name,
    email: student.email,
    phone: student.phone,
    status: recordByStudent.get(student.id)?.status ?? classSession.subject.course.defaultStatus,
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
        <Link href={courseHref(portal, classSession.subject.course.id, "", classSession.subject.id)} className="text-sm text-muted">
          &larr; {classSession.subject.course.name}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
              deleteReturnTo={courseHref(portal, classSession.subject.course.id, "", classSession.subject.id)}
              canChangeDate={canChangeDate}
              canRemove={canRemove}
              allowPastDates={canManagePastDates}
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
          canManage={canManage && hasWorkspaceWrite(session.user.permissions)}
          portal={portal}
        />
      )}
      <SessionHomeworkPanel
        sessionId={sessionId}
        homework={classSession.homework}
        canManage={canManage && hasWorkspaceWrite(session.user.permissions)}
        portal={portal}
        students={students.map((student) => ({
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
        }))}
      />
      {canMarkAttendance ? (
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
                    No students enrolled in this course yet.
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
