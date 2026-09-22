import { isUniqueConstraintError } from "@/lib/flash";
import { hashPassword } from "@/lib/password";
import { enrollStudentInCourse } from "@/modules/roster/service/roster";
import * as db from "../db/repository";

export type ImportErrorCode = "validation" | "missing_role";

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  constructor(message: string, code: ImportErrorCode = "validation") {
    super(message);
    this.name = "ImportError";
    this.code = code;
  }
}

export function isImportError(error: unknown): error is ImportError {
  return error instanceof ImportError;
}

function summarizeImport(created: number, skipped: string[]) {
  const base = created === 1 ? "Imported 1 row." : `Imported ${created} rows.`;
  if (skipped.length === 0) return base;
  const detail = skipped.slice(0, 5).join("; ");
  const more = skipped.length > 5 ? ` (+${skipped.length - 5} more)` : "";
  return `${base} Skipped ${skipped.length}: ${detail}${more}`;
}

export async function importTeachers(input: {
  rows: Array<Record<string, string>>;
  defaultPassword: string;
}): Promise<{ created: number; message: string }> {
  const teacherRole = await db.findRoleByName("Teacher");
  if (!teacherRole) throw new ImportError("Teacher role is missing. Re-seed the database.", "missing_role");

  let created = 0;
  const skipped: string[] = [];

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    const rowLabel = `row ${index + 2}`;
    const name = row.name?.trim() ?? "";
    const email = row.email?.trim().toLowerCase() ?? "";
    const phone = row.phone?.trim() || null;
    const password = (row.password?.trim() || input.defaultPassword).trim();

    if (!name || !email) {
      skipped.push(`${rowLabel} (name and email required)`);
      continue;
    }
    if (!email.includes("@")) {
      skipped.push(`${rowLabel} (invalid email)`);
      continue;
    }
    if (password.length < 8) {
      skipped.push(`${rowLabel} (password must be at least 8 characters)`);
      continue;
    }

    try {
      await db.createTeacherRecord({
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        roleId: teacherRole.id,
      });
      created += 1;
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        skipped.push(`${rowLabel} (email already exists)`);
        continue;
      }
      throw err;
    }
  }

  return { created, message: summarizeImport(created, skipped) };
}

export async function importStudents(input: {
  rows: Array<Record<string, string>>;
  defaultPassword: string;
}): Promise<{ created: number; message: string }> {
  let created = 0;
  const skipped: string[] = [];

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    const rowLabel = `row ${index + 2}`;
    const name = row.name?.trim() ?? "";
    const rollNumber = (row.rollnumber ?? row.roll_number ?? "").trim();
    const email = (row.email ?? "").trim().toLowerCase() || null;
    const phone = (row.phone ?? "").trim() || null;
    const password = (row.password?.trim() || input.defaultPassword).trim();
    const courseCode = (row.coursecode ?? row.course_code ?? "").trim().toUpperCase();

    if (!name || !rollNumber) {
      skipped.push(`${rowLabel} (name and rollNumber required)`);
      continue;
    }
    if (email && !email.includes("@")) {
      skipped.push(`${rowLabel} (invalid email)`);
      continue;
    }
    if (password && password.length < 8) {
      skipped.push(`${rowLabel} (password must be at least 8 characters)`);
      continue;
    }

    let courseId: string | null = null;
    if (courseCode) {
      const course = await db.findCourseByCode(courseCode);
      if (!course?.isActive) {
        skipped.push(`${rowLabel} (course ${courseCode} not found or inactive)`);
        continue;
      }
      courseId = course.id;
    }

    try {
      await db.runTransaction(async (tx) => {
        const student = await db.createStudentInTx(tx, {
          name,
          rollNumber,
          email: email || undefined,
          phone: phone || undefined,
          passwordHash: password ? await hashPassword(password) : undefined,
        });
        if (courseId) await enrollStudentInCourse(student.id, courseId, tx);
      });
      created += 1;
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        skipped.push(`${rowLabel} (roll number or email already exists)`);
        continue;
      }
      throw err;
    }
  }

  return { created, message: summarizeImport(created, skipped) };
}
