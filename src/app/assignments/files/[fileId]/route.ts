import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSubjectFileAccess, redirectToStoredFile } from "@/lib/file-access";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { fileId } = await params;
  const file = await prisma.assignmentFile.findUnique({
    where: { id: fileId },
    select: { fileName: true, storageKey: true, assignment: { select: { subjectId: true } } },
  });
  if (!file) notFound();

  await assertSubjectFileAccess(session, file.assignment.subjectId);
  await redirectToStoredFile(file.storageKey, file.fileName);
}
