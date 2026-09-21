"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { hashPassword } from "@/lib/password";
import { enrollStudentInCourse } from "@/lib/enrollment";
import { MAX_IMPORT_ROWS, recordsFromCsv, requireColumns } from "@/lib/csv";

async function readCsvFile(formData: FormData, path: string) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(flashUrl(path, "error", "Choose a CSV file to import."));
  }
  if (file.size > 512 * 1024) {
    redirect(flashUrl(path, "error", "CSV must be 512 KB or smaller."));
  }
  const parsed = recordsFromCsv(await file.text());
  if ("error" in parsed) redirect(flashUrl(path, "error", parsed.error));
  if (parsed.rows.length === 0) redirect(flashUrl(path, "error", "CSV has a header but no data rows."));
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    redirect(flashUrl(path, "error", `Import at most ${MAX_IMPORT_ROWS} rows at a time.`));
  }
  return parsed;
}

function summarizeImport(created: number, skipped: string[]) {
  const base = created === 1 ? "Imported 1 row." : `Imported ${created} rows.`;
  if (skipped.length === 0) return base;
  const detail = skipped.slice(0, 5).join("; ");
  const more = skipped.length > 5 ? ` (+${skipped.length - 5} more)` : "";
  return `${base} Skipped ${skipped.length}: ${detail}${more}`;
}

export async function importTeachers(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = "/admin/teachers";
  const { headers, rows } = await readCsvFile(formData, path);
  const missing = requireColumns(headers, ["name", "email"]);
  if (missing) redirect(flashUrl(path, "error", missing));

  const defaultPassword = String(formData.get("defaultPassword") ?? "").trim();
  const teacherRole = await prisma.role.findUnique({ where: { name: "Teacher" }, select: { id: true } });
  if (!teacherRole) redirect(flashUrl(path, "error", "Teacher role is missing. Re-seed the database."));

  let created = 0;
  const skipped: string[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowLabel = `row ${index + 2}`;
    const name = row.name?.trim() ?? "";
    const email = row.email?.trim().toLowerCase() ?? "";
    const phone = row.phone?.trim() || null;
    const password = (row.password?.trim() || defaultPassword).trim();

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
      await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash: await hashPassword(password),
          roles: { create: [{ roleId: teacherRole.id }] },
        },
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

  revalidatePath(path);
  redirect(flashUrl(path, created > 0 ? "success" : "error", summarizeImport(created, skipped)));
}

export async function importStudents(formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = "/admin/students";
  const { headers, rows } = await readCsvFile(formData, path);
  const missing = requireColumns(headers, ["name", "rollnumber"]);
  if (missing) redirect(flashUrl(path, "error", missing));

  const defaultPassword = String(formData.get("defaultPassword") ?? "").trim();
  let created = 0;
  const skipped: string[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowLabel = `row ${index + 2}`;
    const name = row.name?.trim() ?? "";
    const rollNumber = (row.rollnumber ?? row.roll_number ?? "").trim();
    const email = (row.email ?? "").trim().toLowerCase() || null;
    const phone = (row.phone ?? "").trim() || null;
    const password = (row.password?.trim() || defaultPassword).trim();
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
      const course = await prisma.course.findUnique({
        where: { code: courseCode },
        select: { id: true, isActive: true },
      });
      if (!course?.isActive) {
        skipped.push(`${rowLabel} (course ${courseCode} not found or inactive)`);
        continue;
      }
      courseId = course.id;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            name,
            rollNumber,
            email: email || undefined,
            phone: phone || undefined,
            passwordHash: password ? await hashPassword(password) : undefined,
          },
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

  revalidatePath(path);
  redirect(flashUrl(path, created > 0 ? "success" : "error", summarizeImport(created, skipped)));
}
