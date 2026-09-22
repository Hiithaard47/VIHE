import type { Session } from "next-auth";
import { canManageSubject } from "@/lib/rbac";
import { hasWorkspaceWrite } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/flash";
import { deleteObject, isStorageConfigured } from "@/lib/storage";
import * as db from "../db/repository";
import { HomeworkError } from "./errors";

export type HomeworkSessionRef = {
  id: string;
  subjectId: string;
  subject: { courseId: string };
  homework: { id: string } | null;
};

async function assertCanManageHomework(
  actor: Session,
  classSession: HomeworkSessionRef,
): Promise<void> {
  if (!(await canManageSubject(actor, classSession.subjectId)) || !hasWorkspaceWrite(actor.user.permissions)) {
    throw new HomeworkError("You cannot manage homework for this session.", "forbidden");
  }
}

export async function loadManageableSession(
  sessionId: string,
  actor: Session,
): Promise<HomeworkSessionRef> {
  const classSession = await db.findSessionForHomework(sessionId);
  if (!classSession) throw new HomeworkError("That session was not found.", "not_found");
  await assertCanManageHomework(actor, classSession);
  return classSession;
}

export async function assignHomework(input: {
  sessionId: string;
  title: string;
  instructions: string | null;
  actor: Session;
}): Promise<{ courseId: string; subjectId: string }> {
  const classSession = await loadManageableSession(input.sessionId, input.actor);
  if (classSession.homework) throw new HomeworkError("This session already has homework.", "already_exists");
  if (!input.title.trim()) throw new HomeworkError("Title is required.", "validation");

  try {
    await db.createSessionHomework({
      sessionId: input.sessionId,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      createdById: input.actor.user.id,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HomeworkError("This session already has homework.", "already_exists");
    }
    throw error;
  }

  return {
    courseId: classSession.subject.courseId,
    subjectId: classSession.subjectId,
  };
}

export async function assignHomeworkForCourse(input: {
  courseId: string;
  sessionId: string;
  title: string;
  instructions: string | null;
  actor: Session;
}): Promise<{ courseId: string; subjectId: string; sessionId: string }> {
  if (!input.sessionId) throw new HomeworkError("Choose a session.", "validation");
  const classSession = await db.findSessionInCourse(input.sessionId, input.courseId);
  if (!classSession) throw new HomeworkError("That session was not found.", "not_found");

  const result = await assignHomework({
    sessionId: input.sessionId,
    title: input.title,
    instructions: input.instructions,
    actor: input.actor,
  });
  return { ...result, sessionId: input.sessionId };
}

export async function removeHomework(input: {
  sessionId: string;
  actor: Session;
}): Promise<{ courseId: string; subjectId: string }> {
  const classSession = await loadManageableSession(input.sessionId, input.actor);
  if (!classSession.homework) throw new HomeworkError("This session has no homework.", "not_found");

  const homework = await db.findHomeworkWithSubmissionFiles(classSession.homework.id);
  if (!homework) throw new HomeworkError("This session has no homework.", "not_found");

  const keys =
    isStorageConfigured()
      ? homework.submissions.flatMap((submission) => submission.files.map((file) => file.storageKey))
      : [];
  await db.deleteSessionHomework(homework.id);
  for (const storageKey of keys) {
    await deleteObject(storageKey).catch(() => {});
  }

  return {
    courseId: classSession.subject.courseId,
    subjectId: classSession.subjectId,
  };
}

/** Used by actions for return-path resolution before service may throw. */
export async function findSessionRef(sessionId: string) {
  return db.findSessionForHomework(sessionId);
}
