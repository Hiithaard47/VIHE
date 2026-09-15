import { deleteObject, isStorageConfigured, putObject } from "@/lib/storage";
import { sanitizeFileName, validateResourceFile } from "@/lib/session-resources";

export { sanitizeFileName, validateResourceFile };

export const MAX_ASSIGNMENT_FILES = 10;

export type UploadedAssignmentFile = {
  file: File;
  fileName: string;
};

export function collectFormFiles(formData: FormData, field = "files"): File[] {
  return formData
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function validateAssignmentUploads(files: File[]) {
  if (files.length === 0) return "Upload at least one PDF or image.";
  if (files.length > MAX_ASSIGNMENT_FILES) {
    return `You can upload at most ${MAX_ASSIGNMENT_FILES} files.`;
  }
  for (const file of files) {
    const invalid = validateResourceFile(file);
    if (invalid) return invalid;
  }
  return null;
}

export function prepareUploadedFiles(files: File[]): UploadedAssignmentFile[] {
  return files.map((file) => ({ file, fileName: sanitizeFileName(file.name) }));
}

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

export async function storeAssignmentUploads(
  uploads: UploadedAssignmentFile[],
  storageKeyFor: (upload: UploadedAssignmentFile, index: number) => string,
) {
  const storedKeys: string[] = [];
  for (const [index, upload] of uploads.entries()) {
    const storageKey = storageKeyFor(upload, index);
    const stored = await storeAssignmentFile(storageKey, upload.file);
    if (stored) {
      await Promise.all(storedKeys.map((key) => deleteObject(key).catch(() => {})));
      return { error: stored as string, storedKeys: [] as string[] };
    }
    storedKeys.push(storageKey);
  }
  return { error: null as string | null, storedKeys };
}

export function assignmentStatus(submission: { marks: number | null } | null) {
  if (!submission) return "Not submitted";
  if (submission.marks === null) return "Submitted";
  return "Graded";
}
