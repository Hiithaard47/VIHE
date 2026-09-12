import { CourseAttendanceView } from "@/components/course-workspace/attendance";

export default async function CourseAttendancePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseAttendanceView courseId={courseId} portal="teacher" />;
}
