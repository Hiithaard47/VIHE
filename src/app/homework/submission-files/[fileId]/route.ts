import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { assertSubjectFileAccess, redirectToStoredFile } from "@/lib/file-access";
import { getSubmissionFileForDownload } from "@/modules/session-homework";

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { fileId } = await params;
  const file = await getSubmissionFileForDownload(fileId);
  if (!file) notFound();

  await assertSubjectFileAccess(
    session,
    file.submission.homework.session.subjectId,
    file.submission.studentId,
  );
  await redirectToStoredFile(file.storageKey, file.fileName);
}
