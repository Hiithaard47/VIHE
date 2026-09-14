import { redirect } from "next/navigation";

export default async function AdminSubjectRosterPage({
  params,
}: {
  params: Promise<{ courseId: string; subjectId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/admin/courses/${courseId}/roster`);
}
