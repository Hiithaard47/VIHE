import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertSubjectFileAccess, redirectToStoredFile } from "@/lib/file-access";

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
      assignment: { select: { subjectId: true } },
    },
  });
  if (!submission) notFound();

  await assertSubjectFileAccess(session, submission.assignment.subjectId, submission.studentId);
  await redirectToStoredFile(submission.storageKey, submission.fileName);
}
