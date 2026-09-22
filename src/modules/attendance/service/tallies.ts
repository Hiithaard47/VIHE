import { emptyTally, type StatusTally, type StatusValue } from "./policy";

export type StudentCategoryTallies = Map<string, Map<string, StatusTally>>;

export function recordInTallies(
  tallies: StudentCategoryTallies,
  studentId: string,
  categoryId: string,
  status: StatusValue,
) {
  let byCategory = tallies.get(studentId);
  if (!byCategory) {
    byCategory = new Map();
    tallies.set(studentId, byCategory);
  }
  const tally = byCategory.get(categoryId) ?? emptyTally();
  tally[status] += 1;
  byCategory.set(categoryId, tally);
}

export function tallyFor(tallies: StudentCategoryTallies, studentId: string, categoryId: string): StatusTally {
  return tallies.get(studentId)?.get(categoryId) ?? emptyTally();
}

export type AttendanceMarks = Map<string, Map<string, StatusValue>>;

export function recordMark(marks: AttendanceMarks, studentId: string, sessionId: string, status: StatusValue) {
  let bySession = marks.get(studentId);
  if (!bySession) {
    bySession = new Map();
    marks.set(studentId, bySession);
  }
  bySession.set(sessionId, status);
}

export function statusAt(marks: AttendanceMarks, studentId: string, sessionId: string): StatusValue | null {
  return marks.get(studentId)?.get(sessionId) ?? null;
}
