import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageBatch } from "@/lib/rbac";
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
    const enrolled = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: resource.session.batchId, studentId: session.user.id } },
    });
    if (!enrolled) notFound();
  } else if (!(await canManageBatch(session, resource.session.batchId))) {
    redirect("/teacher");
  }

  if (!isStorageConfigured()) notFound();
  redirect(await presignedDownloadUrl(resource.storageKey, resource.fileName));
}
