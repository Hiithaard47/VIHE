import type { Session } from "next-auth";
import {
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { isUniqueConstraintError } from "@/lib/flash";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { sessionTiming } from "@/lib/time";
import * as db from "../db/repository";
import { HomeworkError } from "./errors";

export async function submitHomework(input: {
  courseId: string;
  sessionId: string;
  actor: Session;
  files: File[];
}): Promise<{ updated: boolean }> {
  const enrollment = await findStudentCourseEnrollment(input.actor.user.id, input.courseId);
  if (!enrollment) throw new HomeworkError("You are not enrolled in this course.", "not_enrolled");
  if (!enrollment.course.isActive) {
    throw new HomeworkError("This course is completed. You cannot submit.", "inactive");
  }

  const classSession = await db.findSessionForStudentSubmit(input.sessionId, input.courseId);
  if (!classSession?.homework) throw new HomeworkError("This session has no homework.", "not_found");
  if (sessionTiming(classSession.date) !== "today") {
    throw new HomeworkError("Homework can only be submitted on the session day.", "wrong_day");
  }

  const invalid = validateAssignmentUploads(input.files);
  if (invalid) throw new HomeworkError(invalid, "validation");
  if (!isStorageConfigured()) throw new HomeworkError("File storage is not configured.", "storage");

  const uploads = prepareUploadedFiles(input.files);
  let existing = await db.findStudentSubmission(classSession.homework.id, input.actor.user.id);
  let createdFresh = false;

  let submission;
  if (existing) {
    submission = await db.touchStudentSubmission(existing.id);
  } else {
    try {
      submission = await db.createStudentSubmission(classSession.homework.id, input.actor.user.id);
      createdFresh = true;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      existing = await db.findStudentSubmission(classSession.homework.id, input.actor.user.id);
      if (!existing) throw error;
      submission = await db.touchStudentSubmission(existing.id);
    }
  }

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) =>
      `sessions/${input.sessionId}/homework/${submission.id}/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    if (createdFresh) await db.deleteStudentSubmission(submission.id);
    throw new HomeworkError(error, "storage");
  }

  const previousKeys = existing?.files.map((file) => file.storageKey) ?? [];
  try {
    await db.replaceSubmissionFiles(
      submission.id,
      uploads.map((upload, index) => ({
        id: fileIds[index],
        fileName: upload.fileName,
        contentType: upload.file.type,
        sizeBytes: upload.file.size,
        storageKey: storedKeys[index],
      })),
    );
  } catch (fileError) {
    await Promise.all(storedKeys.map((key) => deleteObject(key).catch(() => {})));
    if (createdFresh) await db.deleteStudentSubmission(submission.id);
    throw new HomeworkError("Could not save homework files.", "storage");
  }

  if (previousKeys.length > 0 && isStorageConfigured()) {
    await Promise.all(previousKeys.map((storageKey) => deleteObject(storageKey).catch(() => {})));
  }

  return { updated: Boolean(existing) };
}
