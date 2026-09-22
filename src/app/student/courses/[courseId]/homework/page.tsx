import { notFound } from "next/navigation";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";
import { StudentCourseHomeworkView } from "@/modules/session-homework";

export default async function StudentHomeworkPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  return <StudentCourseHomeworkView courseId={courseId} studentId={session.user.id} />;
}
