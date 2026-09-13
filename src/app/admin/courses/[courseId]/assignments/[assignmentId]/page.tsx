import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminCourseAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { courseId, assignmentId } = await params;
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, batch: { courseId } },
    select: { batchId: true },
  });
  if (!assignment) notFound();
  redirect(`/admin/courses/${courseId}/batches/${assignment.batchId}/assignments/${assignmentId}`);
}
