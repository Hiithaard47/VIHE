import { sessionWhere, subjectWhere, type SubjectScope } from "@/lib/subject-scope";
import * as db from "../db/repository";

export async function getCourseAssignmentsList(courseId: string, scope: SubjectScope) {
  const [assignments, enrollmentCount] = await Promise.all([
    db.listCourseAssignments(sessionWhere(courseId, scope)),
    db.countCourseEnrollments(courseId),
  ]);
  return { assignments, enrollmentCount };
}

export async function getWritableSubjects(courseId: string, scope: SubjectScope) {
  return db.listWritableSubjects(courseId, subjectWhere(scope));
}

export async function getAssignmentDetail(
  assignmentId: string,
  courseId: string,
  scope: SubjectScope,
) {
  return db.findAssignmentDetail(assignmentId, sessionWhere(courseId, scope));
}

/** Subject id for flash redirects when a manage action fails mid-flight. */
export async function findAssignmentSubjectId(assignmentId: string, courseId: string) {
  const assignment = await db.findAssignmentInCourse(assignmentId, courseId);
  return assignment?.subjectId ?? null;
}
