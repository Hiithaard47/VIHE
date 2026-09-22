import * as db from "../db/repository";

export async function getCourseSessionsData(courseId: string, selectedSubjectId?: string) {
  const [course, categories] = await Promise.all([
    db.loadCourseSessionsData(courseId, selectedSubjectId),
    db.loadActiveCategories(),
  ]);
  return { course, categories };
}

export async function getSessionDetail(sessionId: string) {
  return db.loadSessionDetail(sessionId);
}

export async function getSessionSubjectId(sessionId: string) {
  const row = await db.findSessionSubjectId(sessionId);
  return row?.subjectId ?? null;
}
