import { hashPassword } from "@/lib/password";
import { isUniqueConstraintError } from "@/lib/flash";
import { parseDateInput } from "@/lib/time";
import { enrollStudentInCourse } from "@/modules/roster/service/roster";
import * as db from "../db/repository";

export type StudentErrorCode = "not_found" | "validation" | "duplicate" | "archived" | "invalid_course";

export class StudentError extends Error {
  readonly code: StudentErrorCode;
  constructor(message: string, code: StudentErrorCode = "validation") {
    super(message);
    this.name = "StudentError";
    this.code = code;
  }
}

export function isStudentError(error: unknown): error is StudentError {
  return error instanceof StudentError;
}

export async function requireActiveStudent(studentId: string): Promise<void> {
  const student = await db.findStudentActive(studentId);
  if (!student) throw new StudentError("Student not found.", "not_found");
  if (!student.isActive) throw new StudentError("This student is archived. Restore to make changes.", "archived");
}

export async function createStudent(input: {
  name: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  password?: string;
  courseSelections: Array<{ courseId: string; enrolled: boolean }>;
}): Promise<{ name: string }> {
  if (input.password && input.password.length < 8) {
    throw new StudentError("Portal password must be at least 8 characters.", "validation");
  }
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  try {
    await db.runStudentTransaction(async (tx) => {
      const student = await db.createStudentRecord(tx, {
        name: input.name,
        rollNumber: input.rollNumber,
        email: input.email || undefined,
        phone: input.phone?.trim() || undefined,
        passwordHash,
      });
      for (const { courseId, enrolled } of input.courseSelections) {
        if (enrolled) {
          const course = await db.findEnrollableCourse(tx, courseId);
          if (!course?.isActive) throw new StudentError("Select an active course to enroll in.", "invalid_course");
          await enrollStudentInCourse(student.id, courseId, tx);
        }
      }
    });
  } catch (err) {
    if (err instanceof StudentError) throw err;
    if (isUniqueConstraintError(err)) {
      throw new StudentError("That roll number or email is already in use.", "duplicate");
    }
    throw err;
  }

  return { name: input.name };
}

export async function updateStudentDetails(input: {
  studentId: string;
  name: string;
  rollNumber: string;
  email?: string;
  phone?: string;
  password?: string;
  loginExpiresAt?: string;
}): Promise<void> {
  await requireActiveStudent(input.studentId);

  if (input.password && input.password.length < 8) {
    throw new StudentError("Portal password must be at least 8 characters.", "validation");
  }
  const loginExpiresAt = input.loginExpiresAt ? parseDateInput(input.loginExpiresAt) : null;
  if (input.loginExpiresAt && !loginExpiresAt) {
    throw new StudentError("Enter a valid login expiry date.", "validation");
  }

  try {
    await db.updateStudentRecord(input.studentId, {
      name: input.name,
      rollNumber: input.rollNumber,
      email: input.email || null,
      phone: input.phone?.trim() || null,
      loginExpiresAt,
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new StudentError("That roll number or email is already in use.", "duplicate");
    }
    throw err;
  }
}

export async function updateStudentEnrollments(input: {
  studentId: string;
  courseSelections: Array<{ courseId: string; enrolled: boolean }>;
}): Promise<void> {
  await requireActiveStudent(input.studentId);

  try {
    await db.runStudentTransaction(async (tx) => {
      for (const { courseId, enrolled } of input.courseSelections) {
        if (!enrolled) {
          await db.deleteEnrollment(tx, input.studentId, courseId);
          continue;
        }
        const course = await db.findEnrollableCourse(tx, courseId);
        if (!course) throw new StudentError("Select an active course to enroll in.", "invalid_course");
        if (course.isActive) {
          await enrollStudentInCourse(input.studentId, courseId, tx);
          continue;
        }
        const existing = await db.findEnrollment(tx, courseId, input.studentId);
        if (!existing) throw new StudentError("Select an active course to enroll in.", "invalid_course");
      }
    });
  } catch (err) {
    if (err instanceof StudentError) throw err;
    throw err;
  }
}

export async function toggleStudentActive(studentId: string, nextActive: boolean): Promise<void> {
  await db.toggleStudentActiveRecord(studentId, nextActive);
}

export async function approveApplication(input: {
  applicationId: string;
  rollNumber: string;
  reviewerId: string;
}): Promise<{ name: string }> {
  if (!input.rollNumber) throw new StudentError("A roll number is required to approve.", "validation");

  const application = await db.findApplication(input.applicationId);
  if (application.status !== "PENDING") throw new StudentError("That application was already reviewed.", "validation");

  if (application.desiredCourseId) {
    const desiredCourse = await db.findCourseActive(application.desiredCourseId);
    if (!desiredCourse?.isActive) {
      throw new StudentError("That course is archived. Restore it before approving into it.", "validation");
    }
  }

  try {
    await db.runStudentTransaction(async (tx) => {
      const student = await db.createStudentRecord(tx, {
        name: application.name,
        email: application.email,
        phone: application.phone ?? undefined,
        rollNumber: input.rollNumber,
      });
      if (application.desiredCourseId) {
        await enrollStudentInCourse(student.id, application.desiredCourseId, tx);
      }
      await db.updateApplicationStatus(tx, input.applicationId, {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: input.reviewerId,
      });
    });
  } catch (err) {
    if (err instanceof StudentError) throw err;
    if (isUniqueConstraintError(err)) {
      throw new StudentError("That roll number or email is already in use.", "duplicate");
    }
    throw err;
  }

  return { name: application.name };
}

export async function rejectApplication(applicationId: string, reviewerId: string): Promise<void> {
  const application = await db.findApplication(applicationId);
  if (application.status !== "PENDING") {
    throw new StudentError("That application was already reviewed.", "validation");
  }
  await db.rejectApplicationRecord(applicationId, reviewerId);
}
