import type { Session } from "next-auth";
import {
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { findStudentCourseEnrollment } from "@/modules/roster";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { isPastDueDate } from "@/lib/time";
import * as db from "../db/repository";
import { AssignmentError } from "./errors";

export async function submitAssignment(input: {
  courseId: string;
  assignmentId: string;
  actor: Session;
  files: File[];
}): Promise<{ attemptNumber: number }> {
  const enrollment = await findStudentCourseEnrollment(input.actor.user.id, input.courseId);
  if (!enrollment) throw new AssignmentError("You are not enrolled in this course.", "not_enrolled");
  if (!enrollment.course.isActive) {
    throw new AssignmentError("This course is completed. You cannot submit.", "inactive");
  }

  const assignment = await db.findAssignmentForSubmit(input.assignmentId, input.courseId);
  if (!assignment) throw new AssignmentError("That assignment was not found.", "not_found");

  const attempts = await db.findStudentAttempts(input.assignmentId, input.actor.user.id);
  const latest = attempts[0] ?? null;
  const latestGraded = latest?.marks !== null && latest?.marks !== undefined;
  const pastDue = isPastDueDate(assignment.dueDate);

  if (latest && !latestGraded && pastDue) {
    throw new AssignmentError("You cannot replace your upload after the due date until it is graded.", "past_due");
  }

  const invalid = validateAssignmentUploads(input.files);
  if (invalid) throw new AssignmentError(invalid, "validation");
  if (!isStorageConfigured()) throw new AssignmentError("File storage is not configured.", "storage");

  const uploads = prepareUploadedFiles(input.files);
  const attemptNumber = (latest?.attemptNumber ?? 0) + 1;
  const submission = await db.createSubmission({
    assignmentId: input.assignmentId,
    studentId: input.actor.user.id,
    attemptNumber,
  });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) =>
      `assignments/${input.assignmentId}/submissions/${submission.id}/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    await db.deleteSubmission(submission.id);
    throw new AssignmentError(error, "storage");
  }

  try {
    await db.createSubmissionFiles(
      uploads.map((upload, index) => ({
        id: fileIds[index],
        submissionId: submission.id,
        fileName: upload.fileName,
        contentType: upload.file.type,
        sizeBytes: upload.file.size,
        storageKey: storedKeys[index],
      })),
    );
  } catch {
    await Promise.all(storedKeys.map((key) => deleteObject(key).catch(() => {})));
    await db.deleteSubmission(submission.id);
    throw new AssignmentError("Could not save submission files.", "storage");
  }

  return { attemptNumber };
}
