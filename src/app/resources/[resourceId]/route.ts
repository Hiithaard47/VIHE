import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertStudentLoginAllowed, canAccessBatch } from "@/lib/rbac";
import { deniedCourseHref } from "@/lib/course-workspace";
import { PERMISSIONS } from "@/lib/permissions";
import { isStorageConfigured, presignedDownloadUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { resourceId } = await params;
  const resource = await prisma.sessionResource.findUnique({
    where: { id: resourceId },
    select: { fileName: true, storageKey: true, session: { select: { batchId: true } } },
  });
  if (!resource) notFound();

  if (session.user.kind === "student") {
    await assertStudentLoginAllowed(session.user.id);
    const enrolled = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: resource.session.batchId, studentId: session.user.id } },
    });
    if (!enrolled) notFound();
  } else if (!(await canAccessBatch(session, resource.session.batchId))) {
    redirect(deniedCourseHref(session.user.permissions.includes(PERMISSIONS.COURSES_MANAGE) ? "admin" : "teacher"));
  }

  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(resource.storageKey, resource.fileName));
}
