import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    classSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    sessionHomework: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    sessionHomeworkSubmission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sessionHomeworkSubmissionFile: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
    },
    courseEnrollment: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import * as repository from "./repository";

describe("session-homework repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findSessionForHomework queries by id with homework select", async () => {
    prisma.classSession.findUnique.mockResolvedValue({ id: "s1" });
    await repository.findSessionForHomework("s1");
    expect(prisma.classSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" } }),
    );
  });

  it("findSessionInCourse scopes by course", async () => {
    prisma.classSession.findFirst.mockResolvedValue({ id: "s1" });
    await repository.findSessionInCourse("s1", "c1");
    expect(prisma.classSession.findFirst).toHaveBeenCalledWith({
      where: { id: "s1", subject: { courseId: "c1" } },
      select: { id: true, subjectId: true },
    });
  });

  it("createSessionHomework inserts row", async () => {
    const data = {
      sessionId: "s1",
      title: "T",
      instructions: null,
      createdById: "u1",
    };
    prisma.sessionHomework.create.mockResolvedValue({ id: "hw" });
    await repository.createSessionHomework(data);
    expect(prisma.sessionHomework.create).toHaveBeenCalledWith({ data });
  });

  it("replaceSubmissionFiles deletes then creates in a transaction", async () => {
    prisma.sessionHomeworkSubmissionFile.deleteMany.mockResolvedValue({ count: 1 });
    prisma.sessionHomeworkSubmissionFile.createMany.mockResolvedValue({ count: 1 });
    await repository.replaceSubmissionFiles("sub_1", [
      {
        id: "f1",
        fileName: "a.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        storageKey: "k1",
      },
    ]);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.sessionHomeworkSubmissionFile.deleteMany).toHaveBeenCalledWith({
      where: { submissionId: "sub_1" },
    });
    expect(prisma.sessionHomeworkSubmissionFile.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "f1",
          fileName: "a.pdf",
          contentType: "application/pdf",
          sizeBytes: 10,
          storageKey: "k1",
          submissionId: "sub_1",
        },
      ],
    });
  });

  it("listCourseHomeworkSessions uses provided where", async () => {
    prisma.classSession.findMany.mockResolvedValue([]);
    const where = { subjectId: "subj_1" };
    await repository.listCourseHomeworkSessions(where);
    expect(prisma.classSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
  });

  it("countCourseEnrollments counts by course", async () => {
    prisma.courseEnrollment.count.mockResolvedValue(3);
    await expect(repository.countCourseEnrollments("c1")).resolves.toBe(3);
  });

  it("listStudentCourseHomework filters submissions to the student", async () => {
    prisma.sessionHomework.findMany.mockResolvedValue([]);
    await repository.listStudentCourseHomework("c1", "stu_1");
    expect(prisma.sessionHomework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { session: { subject: { courseId: "c1" } } },
        include: expect.objectContaining({
          submissions: expect.objectContaining({ where: { studentId: "stu_1" } }),
        }),
      }),
    );
  });

  it("findSubmissionFileForDownload loads access fields", async () => {
    prisma.sessionHomeworkSubmissionFile.findUnique.mockResolvedValue(null);
    await repository.findSubmissionFileForDownload("file_1");
    expect(prisma.sessionHomeworkSubmissionFile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "file_1" } }),
    );
  });

  it("deleteStudentSubmission swallows errors", async () => {
    prisma.sessionHomeworkSubmission.delete.mockRejectedValue(new Error("gone"));
    await expect(repository.deleteStudentSubmission("sub_1")).resolves.toBeUndefined();
  });
});
