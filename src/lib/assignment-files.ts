import { deleteObject, isStorageConfigured, putObject } from "@/lib/storage";
import { sanitizeFileName, validateResourceFile } from "@/lib/session-resources";

export { sanitizeFileName, validateResourceFile };

export async function storeAssignmentFile(storageKey: string, file: File) {
  if (!isStorageConfigured()) return "File storage is not configured.";
  const invalid = validateResourceFile(file);
  if (invalid) return invalid;
  try {
    await putObject(storageKey, Buffer.from(await file.arrayBuffer()), file.type);
    return null;
  } catch {
    await deleteObject(storageKey).catch(() => {});
    return "Could not store that file.";
  }
}

export function assignmentStatus(submission: { marks: number | null } | null) {
  if (!submission) return "Not submitted";
  if (submission.marks === null) return "Submitted";
  return "Graded";
}
