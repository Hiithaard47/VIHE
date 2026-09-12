import { CourseAssignmentsView } from "@/components/course-workspace/assignments";

export default async function AdminCourseAssignmentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseAssignmentsView courseId={courseId} portal="admin" />;
}
