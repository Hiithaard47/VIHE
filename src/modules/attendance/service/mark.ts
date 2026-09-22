import type { Session } from "next-auth";
import { AttendanceStatus } from "@prisma/client";
import * as db from "../db/repository";
import { AttendanceError } from "./errors";
import { isAttendanceLocked } from "./lock";
import type { StatusValue } from "./policy";

const STATUS_VALUES = new Set<string>(Object.values(AttendanceStatus));

export type AttendanceSessionRef = NonNullable<Awaited<ReturnType<typeof db.findSessionForMarking>>>;

export async function findSessionForAttendance(sessionId: string) {
  return db.findSessionForMarking(sessionId);
}

function isStatusValue(value: string): value is StatusValue {
  return STATUS_VALUES.has(value);
}

export async function markSessionAttendance(input: {
  classSession: AttendanceSessionRef;
  actor: Session;
  statuses: Record<string, string>;
}): Promise<void> {
  if (isAttendanceLocked(input.classSession.date, input.classSession.subject.course.lockAfterDays)) {
    throw new AttendanceError("Attendance is locked for this session.");
  }

  const enrollments = await db.listCourseEnrollmentStudentIds(input.classSession.subject.courseId);
  const marks = enrollments.flatMap(({ studentId }) => {
    const raw = input.statuses[studentId];
    if (typeof raw !== "string" || !isStatusValue(raw)) return [];
    return [{ studentId, status: raw as AttendanceStatus }];
  });

  await db.upsertAttendanceMarks(input.classSession.id, input.actor.user.id, marks);
}

export function parseAttendanceFormStatuses(formData: FormData): Record<string, string> {
  const statuses: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:") || typeof value !== "string") continue;
    statuses[key.slice("status:".length)] = value;
  }
  return statuses;
}
