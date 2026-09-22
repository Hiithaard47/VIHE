import type { SubjectScope } from "@/lib/subject-scope";
import { sessionWhere } from "@/lib/subject-scope";
import * as db from "../db/repository";
import { recordInTallies, recordMark, type AttendanceMarks, type StudentCategoryTallies } from "./tallies";

export async function loadAttendanceTallies(courseId: string, scope: SubjectScope) {
  const records = await db.findAttendanceRecordsForTallies(sessionWhere(courseId, scope));
  const tallies: StudentCategoryTallies = new Map();
  for (const row of records) {
    recordInTallies(tallies, row.studentId, row.session.categoryId, row.status);
  }
  return tallies;
}

export async function loadCourseAttendanceCategories(courseId: string, scope: SubjectScope) {
  return db.findAttendanceCategories(sessionWhere(courseId, scope));
}

export async function loadAttendanceMatrix(courseId: string, scope: SubjectScope) {
  const sessions = await db.findAttendanceMatrixSessions(sessionWhere(courseId, scope));
  const marks: AttendanceMarks = new Map();
  for (const session of sessions) {
    for (const record of session.records) {
      recordMark(marks, record.studentId, session.id, record.status);
    }
  }
  return { sessions, marks };
}

export {
  recordInTallies,
  tallyFor,
  recordMark,
  statusAt,
  type StudentCategoryTallies,
  type AttendanceMarks,
} from "./tallies";
