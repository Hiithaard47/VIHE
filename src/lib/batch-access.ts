export function isBatchAssignableToCourse(
  batch: { courseId: string; isActive: boolean },
  courseId: string,
) {
  return batch.courseId === courseId && batch.isActive;
}
