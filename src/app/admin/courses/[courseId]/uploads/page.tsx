import { CourseUploadsView } from "@/components/course-workspace/uploads";

export default async function AdminCourseUploadsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseUploadsView courseId={courseId} portal="admin" />;
}
