import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function AdminCourseAttendancePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseAttendanceView courseId={courseId} portal="admin" />;
}
