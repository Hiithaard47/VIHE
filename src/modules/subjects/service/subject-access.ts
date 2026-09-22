export function isSubjectAssignableToCourse(
  subject: { courseId: string; isActive: boolean },
  courseId: string,
) {
  return subject.courseId === courseId && subject.isActive;
}
