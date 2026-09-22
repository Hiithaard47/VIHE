import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { HomeworkError } from "./errors";
import { startOfTodayUtc } from "@/lib/time";

vi.mock("../db/repository", () => ({
  findSessionForStudentSubmit: vi.fn(),
  findStudentSubmission: vi.fn(),
  createStudentSubmission: vi.fn(),
  touchStudentSubmission: vi.fn(),
  deleteStudentSubmission: vi.fn(),
  replaceSubmissionFiles: vi.fn(),
}));

vi.mock("@/modules/roster", () => ({
  findStudentCourseEnrollment: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  isStorageConfigured: vi.fn(() => true),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock("@/lib/assignment-files", () => ({
  prepareUploadedFiles: vi.fn(),
  storeAssignmentUploads: vi.fn(),
  validateAssignmentUploads: vi.fn(),
}));

import * as db from "../db/repository";
import { findStudentCourseEnrollment } from "@/modules/roster";
import { isStorageConfigured, deleteObject } from "@/lib/storage";
import {
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { submitHomework } from "./submit";

const student = {
  user: {
    id: "stu_1",
    kind: "student" as const,
    roles: [],
    permissions: [],
    name: "Student",
    email: "s@example.com",
  },
} as unknown as Session;

function pdfFiles() {
  return [new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" })];
}

describe("submitHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findStudentCourseEnrollment).mockResolvedValue({
      course: { isActive: true },
    } as never);
    vi.mocked(db.findSessionForStudentSubmit).mockResolvedValue({
      id: "sess_1",
      date: startOfTodayUtc(),
      homework: { id: "hw_1" },
    });
    vi.mocked(validateAssignmentUploads).mockReturnValue(null);
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(prepareUploadedFiles).mockReturnValue([
      { file: new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }), fileName: "a.pdf" },
    ]);
    vi.mocked(db.findStudentSubmission).mockResolvedValue(null);
    vi.mocked(db.createStudentSubmission).mockResolvedValue({ id: "sub_1" } as never);
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: null, storedKeys: ["key_1"] });
    vi.mocked(db.replaceSubmissionFiles).mockResolvedValue(undefined);
  });

  it("creates a new submission", async () => {
    const result = await submitHomework({
      courseId: "course_1",
      sessionId: "sess_1",
      actor: student,
      files: pdfFiles(),
    });
    expect(result).toEqual({ updated: false });
    expect(db.createStudentSubmission).toHaveBeenCalledWith("hw_1", "stu_1");
    expect(db.replaceSubmissionFiles).toHaveBeenCalled();
  });

  it("updates an existing submission and deletes old storage keys", async () => {
    vi.mocked(db.findStudentSubmission).mockResolvedValue({
      id: "sub_old",
      files: [{ storageKey: "old_key" }],
    } as never);
    vi.mocked(db.touchStudentSubmission).mockResolvedValue({ id: "sub_old" } as never);

    const result = await submitHomework({
      courseId: "course_1",
      sessionId: "sess_1",
      actor: student,
      files: pdfFiles(),
    });
    expect(result).toEqual({ updated: true });
    expect(deleteObject).toHaveBeenCalledWith("old_key");
    expect(db.createStudentSubmission).not.toHaveBeenCalled();
  });

  it("rejects when not enrolled", async () => {
    vi.mocked(findStudentCourseEnrollment).mockResolvedValue(null);
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("You are not enrolled in this course.");
  });

  it("rejects when course is inactive", async () => {
    vi.mocked(findStudentCourseEnrollment).mockResolvedValue({
      course: { isActive: false },
    } as never);
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("This course is completed. You cannot submit.");
  });

  it("rejects when there is no homework", async () => {
    vi.mocked(db.findSessionForStudentSubmit).mockResolvedValue({
      id: "sess_1",
      date: startOfTodayUtc(),
      homework: null,
    });
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("This session has no homework.");
  });

  it("rejects when session day is not today", async () => {
    const tomorrow = new Date(startOfTodayUtc());
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    vi.mocked(db.findSessionForStudentSubmit).mockResolvedValue({
      id: "sess_1",
      date: tomorrow,
      homework: { id: "hw_1" },
    });
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("Homework can only be submitted on the session day.");
  });

  it("rejects invalid uploads", async () => {
    vi.mocked(validateAssignmentUploads).mockReturnValue("Upload at least one PDF, image, audio, or video file.");
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: [],
      }),
    ).rejects.toBeInstanceOf(HomeworkError);
  });

  it("rejects when storage is not configured", async () => {
    vi.mocked(isStorageConfigured).mockReturnValue(false);
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("File storage is not configured.");
  });

  it("rolls back a new submission when store fails", async () => {
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: "Upload failed.", storedKeys: [] });
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("Upload failed.");
    expect(db.deleteStudentSubmission).toHaveBeenCalledWith("sub_1");
  });

  it("recovers from concurrent create unique races as an update", async () => {
    const { Prisma } = await import("@prisma/client");
    vi.mocked(db.createStudentSubmission).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "test" }),
    );
    vi.mocked(db.findStudentSubmission)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub_race",
        files: [{ storageKey: "old_key" }],
      } as never);
    vi.mocked(db.touchStudentSubmission).mockResolvedValue({ id: "sub_race" } as never);

    const result = await submitHomework({
      courseId: "course_1",
      sessionId: "sess_1",
      actor: student,
      files: pdfFiles(),
    });
    expect(result).toEqual({ updated: true });
    expect(db.touchStudentSubmission).toHaveBeenCalledWith("sub_race");
    expect(deleteObject).toHaveBeenCalledWith("old_key");
  });

  it("cleans new storage keys when replaceSubmissionFiles fails", async () => {
    vi.mocked(db.replaceSubmissionFiles).mockRejectedValue(new Error("db down"));
    await expect(
      submitHomework({
        courseId: "course_1",
        sessionId: "sess_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("Could not save homework files.");
    expect(deleteObject).toHaveBeenCalledWith("key_1");
    expect(db.deleteStudentSubmission).toHaveBeenCalledWith("sub_1");
  });
});
