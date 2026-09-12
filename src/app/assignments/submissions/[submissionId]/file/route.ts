import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessBatch } from "@/lib/rbac";
import { deniedCourseHref } from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";
import { isStorageConfigured, presignedDownloadUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { submissionId } = await params;
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: {
      fileName: true,
      storageKey: true,
      studentId: true,
      assignment: { select: { batchId: true } },
    },
  });
  if (!submission) notFound();

  if (session.user.kind === "student") {
    if (submission.studentId !== session.user.id) notFound();
  } else if (!(await canAccessBatch(session, submission.assignment.batchId))) {
    redirect(deniedCourseHref(session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE) ? "admin" : "teacher"));
  }

  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(submission.storageKey, submission.fileName));
}
