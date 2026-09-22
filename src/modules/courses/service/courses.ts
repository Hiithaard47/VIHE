import { isUniqueConstraintError } from "@/lib/flash";
import { loginMonthsForCourseCode } from "@/lib/student-login";
import * as db from "../db/repository";

export type CourseErrorCode = "validation" | "duplicate";

export class CourseError extends Error {
  readonly code: CourseErrorCode;
  constructor(message: string, code: CourseErrorCode = "validation") {
    super(message);
    this.name = "CourseError";
    this.code = code;
  }
}

export function isCourseError(error: unknown): error is CourseError {
  return error instanceof CourseError;
}

export async function createCourse(input: {
  name: string;
  code: string;
  description?: string;
}): Promise<void> {
  try {
    await db.createCourseRecord({
      name: input.name,
      code: input.code,
      description: input.description,
      loginMonths: loginMonthsForCourseCode(input.code),
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new CourseError("That course code is already in use.", "duplicate");
    throw err;
  }
}

export async function toggleCourseActive(courseId: string, nextActive: boolean): Promise<void> {
  await db.toggleCourseActiveRecord(courseId, nextActive);
}

export async function updateCourseDetails(
  courseId: string,
  data: { name: string; code: string; description: string; loginMonths: number | null },
): Promise<void> {
  try {
    await db.updateCourseRecord(courseId, {
      ...data,
      description: data.description.trim() || null,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new CourseError("That course code is already in use.", "duplicate");
    throw err;
  }
}

export async function updateCoursePolicy(
  courseId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await db.updateCourseRecord(courseId, data as Parameters<typeof db.updateCourseRecord>[1]);
}
