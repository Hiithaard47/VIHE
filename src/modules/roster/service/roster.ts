import type { Prisma } from "@prisma/client";
import {
  enrollStudentInCourse as enrollStudentInCourseDb,
  unenrollStudentFromCourse as unenrollStudentFromCourseDb,
  findStudentCourseEnrollment as findStudentCourseEnrollmentDb,
  getOrCreateDefaultSubject as getOrCreateDefaultSubjectDb,
  findActiveStudent,
} from "../db/enrollment";

type EnrollmentTransaction = Prisma.TransactionClient;

export class RosterError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "inactive" = "not_found",
  ) {
    super(message);
    this.name = "RosterError";
  }
}

export function isRosterError(error: unknown): error is RosterError {
  return error instanceof RosterError;
}

export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  tx?: EnrollmentTransaction,
) {
  return enrollStudentInCourseDb(studentId, courseId, tx);
}

export async function enrollActiveStudentInCourse(studentId: string, courseId: string) {
  const student = await findActiveStudent(studentId);
  if (!student) throw new RosterError("That student was not found.", "not_found");
  if (!student.isActive) throw new RosterError("That student is archived.", "inactive");
  return enrollStudentInCourseDb(studentId, courseId);
}

export async function unenrollStudentFromCourse(studentId: string, courseId: string) {
  return unenrollStudentFromCourseDb(studentId, courseId);
}

export async function findStudentCourseEnrollment(studentId: string, courseId: string) {
  return findStudentCourseEnrollmentDb(studentId, courseId);
}

export async function getOrCreateDefaultSubject(courseId: string, tx?: EnrollmentTransaction) {
  return getOrCreateDefaultSubjectDb(courseId, tx);
}
