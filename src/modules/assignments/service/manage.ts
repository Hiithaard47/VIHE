import {
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import { parseDateInput } from "@/lib/time";
import { assertWritableSubject } from "@/lib/subject-scope";
import type { Session } from "next-auth";
import * as db from "../db/repository";
import { AssignmentError } from "./errors";

// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

export async function createAssignment(input: {
  subjectId: string;
  title: string;
  instructions: string | null;
  dueRaw: string | null;
  maxMarks: number;
  files: File[];
  actorId: string;
}): Promise<{ assignmentId: string; subjectId: string }> {
  const title = input.title.trim();
  if (!title) throw new AssignmentError("Title is required.", "validation");
  if (!Number.isFinite(input.maxMarks) || input.maxMarks < 1) {
    throw new AssignmentError("Maximum marks must be at least 1.", "validation");
  }
  const dueDate = input.dueRaw ? parseDateInput(input.dueRaw) : null;
  if (input.dueRaw && !dueDate) throw new AssignmentError("Pick a valid due date.", "validation");
  const instructions = input.instructions?.trim() || null;

  const invalid = validateAssignmentUploads(input.files);
  if (invalid) throw new AssignmentError(invalid, "validation");
  if (!isStorageConfigured()) throw new AssignmentError("File storage is not configured.", "storage");

  const uploads = prepareUploadedFiles(input.files);
  const assignment = await db.createAssignment({
    subjectId: input.subjectId,
    title,
    instructions,
    dueDate,
    maxMarks: input.maxMarks,
    createdById: input.actorId,
  });

  const fileIds = uploads.map(() => crypto.randomUUID().replace(/-/g, "").slice(0, 24));
  const { error, storedKeys } = await storeAssignmentUploads(
    uploads,
    (upload, index) => `assignments/${assignment.id}/prompt/${fileIds[index]}/${upload.fileName}`,
  );
  if (error) {
    await db.rollbackAssignmentRecord(assignment.id);
    throw new AssignmentError(error, "storage");
  }

  try {
    await db.createAssignmentFiles(
      uploads.map((upload, index) => ({
        id: fileIds[index],
        assignmentId: assignment.id,
        fileName: upload.fileName,
        contentType: upload.file.type,
        sizeBytes: upload.file.size,
        storageKey: storedKeys[index],
      })),
    );
  } catch {
    await Promise.all(storedKeys.map((key) => deleteObject(key).catch(() => {})));
    await db.rollbackAssignmentRecord(assignment.id);
    throw new AssignmentError("Could not save assignment files.", "storage");
  }

  return { assignmentId: assignment.id, subjectId: input.subjectId };
}

// ---------------------------------------------------------------------------
// gradeSubmission
// ---------------------------------------------------------------------------

export async function gradeSubmission(input: {
  courseId: string;
  assignmentId: string;
  studentId: string;
  submissionId: string | null;
  marks: number;
  feedback: string | null;
  actor: Session;
}): Promise<{ attemptNumber: number; subjectId: string }> {
  const assignment = await db.findAssignmentInCourse(input.assignmentId, input.courseId);
  if (!assignment) throw new AssignmentError("That assignment was not found.", "not_found");

  const subjectId = await assertWritableSubject(input.actor, input.courseId, assignment.subjectId);
  if (!subjectId) {
    throw new AssignmentError("You cannot manage assignments for that subject.", "forbidden");
  }

  const submission = input.submissionId
    ? await db.findSubmission(input.submissionId, input.assignmentId, input.studentId)
    : await db.findLatestSubmission(input.assignmentId, input.studentId);
  if (!submission) throw new AssignmentError("This student has not submitted yet.", "no_submission");

  if (!Number.isFinite(input.marks) || input.marks < 0 || input.marks > assignment.maxMarks) {
    throw new AssignmentError(`Marks must be between 0 and ${assignment.maxMarks}.`, "validation");
  }

  await db.updateSubmissionGrade(submission.id, {
    marks: input.marks,
    feedback: input.feedback,
    gradedById: input.actor.user.id,
  });

  return { attemptNumber: submission.attemptNumber, subjectId };
}

// ---------------------------------------------------------------------------
// deleteAssignment
// ---------------------------------------------------------------------------

export async function deleteAssignment(input: {
  courseId: string;
  assignmentId: string;
  actor: Session;
}): Promise<{ subjectId: string }> {
  const assignment = await db.findAssignmentWithFiles(input.assignmentId, input.courseId);
  if (!assignment) throw new AssignmentError("That assignment was not found.", "not_found");

  const subjectId = await assertWritableSubject(input.actor, input.courseId, assignment.subjectId);
  if (!subjectId) {
    throw new AssignmentError("You cannot manage assignments for that subject.", "forbidden");
  }

  const keys = [
    ...assignment.files.map((file) => file.storageKey),
    ...assignment.submissions.flatMap((submission) => submission.files.map((file) => file.storageKey)),
  ];
  await db.deleteAssignmentRecord(assignment.id);
  if (isStorageConfigured() && keys.length > 0) {
    await Promise.all(keys.map((key) => deleteObject(key).catch(() => {})));
  }

  return { subjectId };
}
