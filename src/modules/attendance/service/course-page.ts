import type { SubjectScope } from "@/lib/subject-scope";
import * as db from "../db/repository";
import {
  loadAttendanceMatrix,
  loadAttendanceTallies,
  loadCourseAttendanceCategories,
} from "./queries";

export async function loadCourseAttendancePage(input: {
  courseId: string;
  scope: SubjectScope;
  selectedSubjectId?: string;
}) {
  const subjectId =
    input.selectedSubjectId ??
    (input.scope.kind === "ids" && input.scope.ids.length === 1 ? input.scope.ids[0] : undefined);

  const [course, subject, teachers, categories, tallies, matrix] = await Promise.all([
    db.findCourseAttendanceHeader(input.courseId),
    subjectId ? db.findSubjectName(subjectId) : Promise.resolve(null),
    db.findSubjectTeacherNames(input.courseId, input.scope, subjectId),
    loadCourseAttendanceCategories(input.courseId, input.scope),
    loadAttendanceTallies(input.courseId, input.scope),
    loadAttendanceMatrix(input.courseId, input.scope),
  ]);

  return { course, subject, teachers, categories, tallies, matrix, subjectId };
}
