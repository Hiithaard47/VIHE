import { deleteObject, isStorageConfigured, putObject } from "@/lib/storage";
import { sanitizeFileName } from "@/modules/session-resources/service/session-resources";

export { sanitizeFileName };

export const MAX_ASSIGNMENT_FILES = 10;
export const MAX_ASSIGNMENT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ASSIGNMENT_MEDIA_BYTES = 5 * 1024 * 1024;

const DOCUMENT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

const MEDIA_TYPES: Record<string, string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a"],
  "audio/wav": [".wav"],
  "audio/webm": [".webm"],
  "audio/ogg": [".ogg"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};

export const ASSIGNMENT_FILE_ACCEPT = [
  ...Object.keys(DOCUMENT_TYPES),
  ...Object.keys(MEDIA_TYPES),
].join(",");

export type UploadedAssignmentFile = {
  file: File;
  fileName: string;
};

export function collectFormFiles(formData: FormData, field = "files"): File[] {
  return formData
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function validateAssignmentFile(file: File) {
  if (file.size <= 0) return "Choose a file to upload.";
  if (DOCUMENT_TYPES[file.type]) {
    if (file.size > MAX_ASSIGNMENT_DOCUMENT_BYTES) return "PDF and image files must be 10 MB or smaller.";
    return null;
  }
  if (MEDIA_TYPES[file.type]) {
    if (file.size > MAX_ASSIGNMENT_MEDIA_BYTES) return "Audio and video files must be 5 MB or smaller.";
    return null;
  }
  return "Only PDF, image, audio, or video files can be uploaded.";
}

export function validateAssignmentUploads(files: File[]) {
  if (files.length === 0) return "Upload at least one PDF, image, audio, or video file.";
  if (files.length > MAX_ASSIGNMENT_FILES) {
    return `You can upload at most ${MAX_ASSIGNMENT_FILES} files.`;
  }
  for (const file of files) {
    const invalid = validateAssignmentFile(file);
    if (invalid) return invalid;
  }
  return null;
}

export function prepareUploadedFiles(files: File[]): UploadedAssignmentFile[] {
  return files.map((file) => ({ file, fileName: sanitizeFileName(file.name) }));
}

export async function storeAssignmentFile(storageKey: string, file: File) {
  if (!isStorageConfigured()) return "File storage is not configured.";
  const invalid = validateAssignmentFile(file);
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
