"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requireSubjectAccess } from "@/lib/rbac";
import { hasWorkspaceWrite, PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { deleteObject, isStorageConfigured, putObject } from "@/lib/storage";
import { sanitizeFileName, validateResourceFile } from "./service/session-resources";
import { sessionResourceUploadError } from "@/modules/session-categories/service/session-categories";
import { parseCoursePortal, safeWorkspaceReturnTo, sessionHref, type CoursePortal } from "@/lib/course-workspace";
import * as db from "./db/repository";

async function requireResourceWrite(subjectId: string, portal: CoursePortal) {
  const session = await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  if (!hasWorkspaceWrite(session.user.permissions)) {
    return null;
  }
  await requireSubjectAccess(subjectId, portal);
  return session;
}

export async function uploadSessionResource(sessionId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const path = sessionHref(portal, sessionId);
  await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  const classSession = await db.findSessionForUpload(sessionId);
  const session = await requireResourceWrite(classSession.subjectId, portal);
  if (!session) redirect(flashUrl(path, "error", "You cannot upload files for this session."));

  const blocked = sessionResourceUploadError(classSession.category.allowsResources);
  if (blocked) redirect(flashUrl(path, "error", blocked));

  if (!isStorageConfigured()) {
    redirect(flashUrl(path, "error", "File storage is not configured."));
  }

  const file = formData.get("file");
  if (!(file instanceof File)) redirect(flashUrl(path, "error", "Choose a file to upload."));
  const invalid = validateResourceFile(file);
  if (invalid) redirect(flashUrl(path, "error", invalid));

  const fileName = sanitizeFileName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const resource = await db.createResourceRecord({
    sessionId,
    fileName,
    contentType: file.type,
    sizeBytes: file.size,
    storageKey: `pending/${sessionId}/${crypto.randomUUID()}`,
    uploadedById: session.user.id,
  });
  const storageKey = `sessions/${sessionId}/${resource.id}/${fileName}`;

  try {
    await putObject(storageKey, bytes, file.type);
    await db.updateResourceStorageKey(resource.id, storageKey);
  } catch {
    await db.deleteResourceRecord(resource.id);
    await deleteObject(storageKey).catch(() => {});
    redirect(flashUrl(path, "error", "Could not store that file."));
  }

  revalidatePath(path);
  redirect(flashUrl(path, "success", `${fileName} was uploaded.`));
}

export async function deleteSessionResource(
  sessionId: string,
  resourceId: string,
  portalArg: CoursePortal,
  formData?: FormData,
) {
  const portal = parseCoursePortal(portalArg);
  const path = sessionHref(portal, sessionId);
  const returnTo = safeWorkspaceReturnTo(formData?.get("returnTo") ?? null, path);
  await requireAnyPermission([
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.COURSES_CONFIGURE,
    PERMISSIONS.COURSES_MANAGE,
  ]);
  const resource = await db.findResourceWithSession(resourceId);
  if (resource.session.id !== sessionId) redirect(flashUrl(returnTo, "error", "That file is not on this session."));
  const session = await requireResourceWrite(resource.session.subjectId, portal);
  if (!session) redirect(flashUrl(returnTo, "error", "You cannot remove files for this session."));

  const storageKey = resource.storageKey;
  await db.deleteResourceById(resourceId);
  if (isStorageConfigured()) {
    await deleteObject(storageKey).catch(() => {});
  }

  revalidatePath(path);
  revalidatePath(returnTo);
  redirect(flashUrl(returnTo, "success", "File removed."));
}
