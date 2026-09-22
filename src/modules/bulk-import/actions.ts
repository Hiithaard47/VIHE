"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { MAX_IMPORT_ROWS, recordsFromCsv, requireColumns } from "@/lib/csv";
import {
  importTeachers as importTeachersService,
  importStudents as importStudentsService,
  isImportError,
} from "./service/import";

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

function fail(path: string, error: unknown): never {
  if (isImportError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function importTeachers(formData: FormData) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const path = "/admin/teachers";
  const { headers, rows } = await readCsvFile(formData, path);
  const missing = requireColumns(headers, ["name", "email"]);
  if (missing) redirect(flashUrl(path, "error", missing));

  const defaultPassword = String(formData.get("defaultPassword") ?? "").trim();

  try {
    const result = await importTeachersService({ rows, defaultPassword });
    revalidatePath(path);
    redirect(flashUrl(path, result.created > 0 ? "success" : "error", result.message));
  } catch (error) {
    fail(path, error);
  }
}

export async function importStudents(formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = "/admin/students";
  const { headers, rows } = await readCsvFile(formData, path);
  const missing = requireColumns(headers, ["name", "rollnumber"]);
  if (missing) redirect(flashUrl(path, "error", missing));

  const defaultPassword = String(formData.get("defaultPassword") ?? "").trim();

  try {
    const result = await importStudentsService({ rows, defaultPassword });
    revalidatePath(path);
    redirect(flashUrl(path, result.created > 0 ? "success" : "error", result.message));
  } catch (error) {
    fail(path, error);
  }
}
