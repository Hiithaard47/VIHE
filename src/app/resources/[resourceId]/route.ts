import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertBatchFileAccess, redirectToStoredFile } from "@/lib/file-access";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { resourceId } = await params;
  const resource = await prisma.sessionResource.findUnique({
    where: { id: resourceId },
    select: { fileName: true, storageKey: true, session: { select: { batchId: true } } },
  });
  if (!resource) notFound();

  await assertBatchFileAccess(session, resource.session.batchId);
  await redirectToStoredFile(resource.storageKey, resource.fileName);
}
