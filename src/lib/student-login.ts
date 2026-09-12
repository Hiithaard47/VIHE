import type { Prisma } from "@prisma/client";
import { sessionDateUtc, startOfTodayUtc } from "@/lib/time";

export const LOGIN_MONTH_CHOICES = [6, 12, 48] as const;

export function loginMonthsForCourseCode(code: string): number | null {
  const compact = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^BSA\d*$/.test(compact) || /^BPV\d*$/.test(compact)) return 6;
  if (/^BVA\d*$/.test(compact)) return 48;
  if (/^BS\d*$/.test(compact)) return 12;
  if (/^BV\d*$/.test(compact)) return 48;
  return null;
}

export function addCalendarMonths(from: Date, months: number): Date {
  const start = startOfTodayUtc(from);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
}

export function resolveLoginExpiresAt(
  existing: Date | null | undefined,
  months: number | null | undefined,
  now = new Date(),
): Date | null {
  if (existing) return existing;
  if (!months) return null;
  return addCalendarMonths(now, months);
}

export function isStudentLoginExpired(loginExpiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!loginExpiresAt) return false;
  return sessionDateUtc(loginExpiresAt).getTime() < startOfTodayUtc(now).getTime();
}

export function courseLoginMonths(course: { loginMonths?: number | null; code: string }): number | null {
  return course.loginMonths ?? loginMonthsForCourseCode(course.code);
}

export function parseLoginMonthsInput(raw: FormDataEntryValue | null): number | null | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const months = Number(value);
  if ((LOGIN_MONTH_CHOICES as readonly number[]).includes(months)) return months;
  return undefined;
}

export async function applyDefaultLoginExpiry(
  studentId: string,
  courseId: string,
  tx: Pick<Prisma.TransactionClient, "student" | "course">,
) {
  const student = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { loginExpiresAt: true },
  });
  if (student.loginExpiresAt) return;

  const course = await tx.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { loginMonths: true, code: true },
  });
  const next = resolveLoginExpiresAt(null, courseLoginMonths(course));
  if (!next) return;

  await tx.student.update({
    where: { id: studentId },
    data: { loginExpiresAt: next },
  });
}
