import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSubjectFileAccess, redirectToStoredFile } from "@/lib/file-access";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { assignmentId } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { fileName: true, storageKey: true, subjectId: true },
  });
  if (!assignment) notFound();

  await assertSubjectFileAccess(session, assignment.subjectId);
  await redirectToStoredFile(assignment.storageKey, assignment.fileName);
}
