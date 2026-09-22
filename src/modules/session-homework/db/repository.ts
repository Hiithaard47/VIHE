import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findSessionForHomework(sessionId: string) {
  return prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      subjectId: true,
      subject: { select: { courseId: true } },
      homework: { select: { id: true } },
    },
  });
}

export async function findSessionInCourse(sessionId: string, courseId: string) {
  return prisma.classSession.findFirst({
    where: { id: sessionId, subject: { courseId } },
    select: { id: true, subjectId: true },
  });
}

export async function createSessionHomework(data: {
  sessionId: string;
  title: string;
  instructions: string | null;
  createdById: string;
}) {
  return prisma.sessionHomework.create({ data });
}

export async function findHomeworkWithSubmissionFiles(homeworkId: string) {
  return prisma.sessionHomework.findUnique({
    where: { id: homeworkId },
    include: { submissions: { include: { files: { select: { storageKey: true } } } } },
  });
}

export async function deleteSessionHomework(homeworkId: string) {
  return prisma.sessionHomework.delete({ where: { id: homeworkId } });
}

export async function findSessionForStudentSubmit(sessionId: string, courseId: string) {
  return prisma.classSession.findFirst({
    where: { id: sessionId, subject: { courseId } },
    select: {
      id: true,
      date: true,
      homework: { select: { id: true } },
    },
  });
}

export async function findStudentSubmission(homeworkId: string, studentId: string) {
  return prisma.sessionHomeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
    include: { files: { select: { storageKey: true } } },
  });
}

export async function createStudentSubmission(homeworkId: string, studentId: string) {
  return prisma.sessionHomeworkSubmission.create({
    data: { homeworkId, studentId },
  });
}

export async function touchStudentSubmission(submissionId: string) {
  return prisma.sessionHomeworkSubmission.update({
    where: { id: submissionId },
    data: { submittedAt: new Date() },
  });
}

export async function deleteStudentSubmission(submissionId: string) {
  return prisma.sessionHomeworkSubmission.delete({ where: { id: submissionId } }).catch(() => {});
}

export async function replaceSubmissionFiles(
  submissionId: string,
  files: Array<{
    id: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  }>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.sessionHomeworkSubmissionFile.deleteMany({ where: { submissionId } });
    await tx.sessionHomeworkSubmissionFile.createMany({
      data: files.map((file) => ({ ...file, submissionId })),
    });
  });
}

export async function listCourseHomeworkSessions(where: Prisma.ClassSessionWhereInput) {
  return prisma.classSession.findMany({
    where,
    select: {
      id: true,
      name: true,
      date: true,
      subject: { select: { id: true, name: true } },
      homework: {
        select: {
          id: true,
          title: true,
          _count: { select: { submissions: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function countCourseEnrollments(courseId: string) {
  return prisma.courseEnrollment.count({ where: { courseId } });
}

export async function listStudentCourseHomework(courseId: string, studentId: string) {
  return prisma.sessionHomework.findMany({
    where: { session: { subject: { courseId } } },
    include: {
      session: { select: { id: true, name: true, date: true } },
      submissions: {
        where: { studentId },
        take: 1,
        select: { id: true, submittedAt: true },
      },
    },
    orderBy: { session: { date: "desc" } },
  });
}

export async function findSubmissionFileForDownload(fileId: string) {
  return prisma.sessionHomeworkSubmissionFile.findUnique({
    where: { id: fileId },
    select: {
      fileName: true,
      storageKey: true,
      submission: {
        select: {
          studentId: true,
          homework: { select: { session: { select: { subjectId: true } } } },
        },
      },
    },
  });
}
