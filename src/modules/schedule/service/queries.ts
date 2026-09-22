import type { Prisma } from "@prisma/client";
import * as db from "../db/repository";

export async function getCourseScheduleData(
  courseId: string,
  subjectWhere: Prisma.CourseSubjectWhereInput,
) {
  const [course, categories] = await Promise.all([
    db.loadCourseScheduleData(courseId, subjectWhere),
    db.loadActiveCategories(),
  ]);
  return { course, categories };
}
