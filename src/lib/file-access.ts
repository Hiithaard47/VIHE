import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { assertStudentLoginAllowed, canAccessSubject } from "@/lib/rbac";
import { deniedCourseHref } from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";
import { isStorageConfigured, presignedDownloadUrl } from "@/lib/storage";

export async function assertSubjectFileAccess(
  session: Session,
  subjectId: string,
  ownerStudentId?: string,
) {
  if (session.user.kind === "student") {
    await assertStudentLoginAllowed(session.user.id);
    if (ownerStudentId && ownerStudentId !== session.user.id) notFound();
    const subject = await prisma.courseSubject.findUnique({
      where: { id: subjectId },
      select: { courseId: true },
    });
    if (!subject) notFound();
    const enrolled = await prisma.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: subject.courseId, studentId: session.user.id } },
    });
    if (!enrolled) notFound();
    return;
  }
  if (!(await canAccessSubject(session, subjectId))) {
    redirect(deniedCourseHref(session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE) ? "admin" : "teacher"));
  }
}

export async function redirectToStoredFile(storageKey: string, fileName: string) {
  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(storageKey, fileName));
}
