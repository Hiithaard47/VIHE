import { sessionWhere, type SubjectScope } from "@/lib/subject-scope";
import * as db from "../db/repository";

export async function getCourseHomeworkList(courseId: string, scope: SubjectScope) {
  const [sessions, enrollmentCount] = await Promise.all([
    db.listCourseHomeworkSessions(sessionWhere(courseId, scope)),
    db.countCourseEnrollments(courseId),
  ]);
  return {
    sessions,
    enrollmentCount,
    withHomework: sessions.filter((item) => item.homework),
    withoutHomework: sessions.filter((item) => !item.homework),
  };
}

export async function getStudentCourseHomework(courseId: string, studentId: string) {
  const homeworks = await db.listStudentCourseHomework(courseId, studentId);
  return {
    pending: homeworks.filter((item) => item.submissions.length === 0),
    submitted: homeworks.filter((item) => item.submissions.length > 0),
  };
}

export async function getSubmissionFileForDownload(fileId: string) {
  return db.findSubmissionFileForDownload(fileId);
}
