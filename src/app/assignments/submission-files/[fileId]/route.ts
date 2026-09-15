import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSubjectFileAccess, redirectToStoredFile } from "@/lib/file-access";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { fileId } = await params;
  const file = await prisma.assignmentSubmissionFile.findUnique({
    where: { id: fileId },
    select: {
      fileName: true,
      storageKey: true,
      submission: {
        select: {
          studentId: true,
          assignment: { select: { subjectId: true } },
        },
      },
    },
  });
  if (!file) notFound();

  await assertSubjectFileAccess(session, file.submission.assignment.subjectId, file.submission.studentId);
  await redirectToStoredFile(file.storageKey, file.fileName);
}
