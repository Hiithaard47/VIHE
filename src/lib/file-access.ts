import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { assertStudentLoginAllowed, canAccessBatch } from "@/lib/rbac";
import { deniedCourseHref } from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";
import { isStorageConfigured, presignedDownloadUrl } from "@/lib/storage";

export async function assertBatchFileAccess(
  session: Session,
  batchId: string,
  ownerStudentId?: string,
) {
  if (session.user.kind === "student") {
    await assertStudentLoginAllowed(session.user.id);
    if (ownerStudentId && ownerStudentId !== session.user.id) notFound();
    const enrolled = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId: session.user.id } },
    });
    if (!enrolled) notFound();
    return;
  }
  if (!(await canAccessBatch(session, batchId))) {
    redirect(deniedCourseHref(session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE) ? "admin" : "teacher"));
  }
}

export async function redirectToStoredFile(storageKey: string, fileName: string) {
  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(storageKey, fileName));
}
