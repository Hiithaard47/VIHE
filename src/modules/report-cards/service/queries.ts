import * as db from "../db/repository";
import {
  attendancePercent,
  categoryAttendancePolicy,
  emptyTally,
  type StatusValue,
  type StatusTally,
} from "@/modules/attendance/service/policy";

export type ReportCardData = Awaited<
  ReturnType<typeof getCourseReportCardData>
>;

export async function getCourseReportCardData(courseId: string) {
  const data = await db.loadCourseReportCardData(courseId);

  if (!data) return null;

  // Deduplicate and sort teachers
  const teacherMap = new Map<string, string>();
  for (const subject of data.subjects) {
    for (const { teacher } of subject.teachers) {
      teacherMap.set(teacher.id, teacher.name);
    }
  }
  const teachers = Array.from(teacherMap.values()).sort((a, b) =>
    a.localeCompare(b),
  );

  // Deduplicate and sort attendance categories
  const categoryMap = new Map<
    string,
    { id: string; name: string; minAttendancePercent: number | null }
  >();
  for (const subject of data.subjects) {
    for (const session of subject.sessions) {
      if (session.category.isActive) {
        categoryMap.set(session.category.id, {
          id: session.category.id,
          name: session.category.name,
          minAttendancePercent: session.category.minAttendancePercent,
        });
      }
    }
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  // Transform subjects
  const subjects = data.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    assignments: subject.assignments.map((assignment) => {
      // Select latest attempt per student
      const latestByStudent = new Map<
        string,
        (typeof assignment.submissions)[number]
      >();
      for (const submission of assignment.submissions) {
        const current = latestByStudent.get(submission.studentId);
        if (!current || submission.attemptNumber > current.attemptNumber) {
          latestByStudent.set(submission.studentId, submission);
        }
      }
      return {
        id: assignment.id,
        title: assignment.title,
        maxMarks: assignment.maxMarks,
        latestSubmissions: latestByStudent,
      };
    }),
    sessions: subject.sessions,
  }));

  return {
    course: {
      name: data.name,
      code: data.code,
      lateCountsAsAttended: data.lateCountsAsAttended,
      excusedCountsAsAttended: data.excusedCountsAsAttended,
    },
    teachers,
    categories,
    subjects,
    students: data.enrollments.map(({ student }) => student),
    printedAt: new Date(),
  };
}

/**
 * Calculate attendance tally for a single student in a single category.
 * Returns a tally with counts for PRESENT, ABSENT, LATE, EXCUSED.
 */
export function calculateStudentCategoryAttendance(
  subjects: ReportCardData extends null
    ? never
    : NonNullable<ReportCardData>["subjects"],
  studentId: string,
  categoryId: string,
): StatusTally {
  const tally = emptyTally();

  if (!subjects) return tally;

  for (const subject of subjects) {
    for (const session of subject.sessions) {
      if (session.category.id === categoryId) {
        for (const record of session.records) {
          if (record.studentId === studentId) {
            tally[record.status as StatusValue] += 1;
          }
        }
      }
    }
  }

  return tally;
}

/**
 * Calculate total marks and marks obtained for a student.
 */
export function calculateStudentAssignmentTotals(
  subjects: ReportCardData extends null
    ? never
    : NonNullable<ReportCardData>["subjects"],
  studentId: string,
): { totalPossible: number; totalScored: number } {
  let totalPossible = 0;
  let totalScored = 0;

  if (!subjects) return { totalPossible, totalScored };

  for (const subject of subjects) {
    for (const assignment of subject.assignments) {
      totalPossible += assignment.maxMarks;
      const submission = assignment.latestSubmissions.get(studentId);
      if (submission && submission.marks !== null) {
        totalScored += submission.marks;
      }
    }
  }

  return { totalPossible, totalScored };
}