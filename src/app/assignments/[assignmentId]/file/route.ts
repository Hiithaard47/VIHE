import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessBatch } from "@/lib/rbac";
import { deniedCourseHref } from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";
import { isStorageConfigured, presignedDownloadUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { assignmentId } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { fileName: true, storageKey: true, batchId: true },
  });
  if (!assignment) notFound();

  if (session.user.kind === "student") {
    const enrolled = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: assignment.batchId, studentId: session.user.id } },
    });
    if (!enrolled) notFound();
  } else if (!(await canAccessBatch(session, assignment.batchId))) {
    redirect(deniedCourseHref(session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE) ? "admin" : "teacher"));
  }

  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(assignment.storageKey, assignment.fileName));
}
