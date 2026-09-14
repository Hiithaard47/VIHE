import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function AdminSubjectAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { courseId, subjectId } = await params;
  const { category } = await searchParams;
  return (
    <CourseAttendanceView
      courseId={courseId}
      portal="admin"
      categoryId={category}
      selectedSubjectId={subjectId}
    />
  );
}
