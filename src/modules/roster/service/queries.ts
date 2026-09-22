import * as db from "../db/enrollment";

export async function getCourseRosterData(courseId: string) {
  return db.loadCourseRosterData(courseId);
}

export async function getAvailableStudents(excludeIds: string[]) {
  return db.findAvailableStudents(excludeIds);
}
