export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;

export const RESOURCE_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

export function sanitizeFileName(name: string) {
  const trimmed = name.trim().replace(/[/\\]/g, "").slice(0, 180);
  return trimmed || "file";
}

export function validateResourceFile(file: File) {
  if (file.size <= 0) return "Choose a file to upload.";
  if (file.size > MAX_RESOURCE_BYTES) return "Files must be 10 MB or smaller.";
  if (!RESOURCE_TYPES[file.type]) return "Only PDF and image files can be uploaded.";
  return null;
}
