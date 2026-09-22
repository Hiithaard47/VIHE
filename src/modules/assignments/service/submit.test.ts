import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { AssignmentError } from "./errors";

vi.mock("../db/repository", () => ({
  findAssignmentForSubmit: vi.fn(),
  findStudentAttempts: vi.fn(),
  createSubmission: vi.fn(),
  deleteSubmission: vi.fn(),
  createSubmissionFiles: vi.fn(),
}));

vi.mock("@/lib/enrollment", () => ({
  findStudentCourseEnrollment: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  isStorageConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/assignment-files", () => ({
  prepareUploadedFiles: vi.fn(),
  storeAssignmentUploads: vi.fn(),
  validateAssignmentUploads: vi.fn(),
}));

vi.mock("@/lib/time", () => ({
  isPastDueDate: vi.fn(() => false),
}));

import * as db from "../db/repository";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { isStorageConfigured } from "@/lib/storage";
import {
  prepareUploadedFiles,
  storeAssignmentUploads,
  validateAssignmentUploads,
} from "@/lib/assignment-files";
import { isPastDueDate } from "@/lib/time";
import { submitAssignment } from "./submit";

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

describe("submitAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findStudentCourseEnrollment).mockResolvedValue({
      course: { isActive: true },
    } as never);
    vi.mocked(db.findAssignmentForSubmit).mockResolvedValue({
      id: "asgn_1",
      dueDate: null,
    });
    vi.mocked(db.findStudentAttempts).mockResolvedValue([]);
    vi.mocked(isPastDueDate).mockReturnValue(false);
    vi.mocked(validateAssignmentUploads).mockReturnValue(null);
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(prepareUploadedFiles).mockReturnValue([
      { file: new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }), fileName: "a.pdf" },
    ]);
    vi.mocked(db.createSubmission).mockResolvedValue({ id: "sub_1" } as never);
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: null, storedKeys: ["key_1"] });
    vi.mocked(db.createSubmissionFiles).mockResolvedValue({ count: 1 } as never);
  });

  it("creates first submission", async () => {
    const result = await submitAssignment({
      courseId: "course_1",
      assignmentId: "asgn_1",
      actor: student,
      files: pdfFiles(),
    });
    expect(result).toEqual({ attemptNumber: 1 });
    expect(db.createSubmission).toHaveBeenCalledWith({
      assignmentId: "asgn_1",
      studentId: "stu_1",
      attemptNumber: 1,
    });
    expect(db.createSubmissionFiles).toHaveBeenCalled();
  });

  it("increments attempt number for subsequent submissions", async () => {
    vi.mocked(db.findStudentAttempts).mockResolvedValue([
      { id: "sub_old", attemptNumber: 2, marks: 80 },
    ] as never);
    const result = await submitAssignment({
      courseId: "course_1",
      assignmentId: "asgn_1",
      actor: student,
      files: pdfFiles(),
    });
    expect(result).toEqual({ attemptNumber: 3 });
  });

  it("rejects when not enrolled", async () => {
    vi.mocked(findStudentCourseEnrollment).mockResolvedValue(null);
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
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
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("This course is completed. You cannot submit.");
  });

  it("rejects when assignment is missing", async () => {
    vi.mocked(db.findAssignmentForSubmit).mockResolvedValue(null);
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "missing",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("That assignment was not found.");
  });

  it("rejects past-due ungraded resubmission", async () => {
    vi.mocked(db.findStudentAttempts).mockResolvedValue([
      { id: "sub_old", attemptNumber: 1, marks: null },
    ] as never);
    vi.mocked(isPastDueDate).mockReturnValue(true);
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("You cannot replace your upload after the due date until it is graded.");
  });

  it("rejects invalid uploads", async () => {
    vi.mocked(validateAssignmentUploads).mockReturnValue("Upload at least one PDF, image, audio, or video file." as never);
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
        actor: student,
        files: [],
      }),
    ).rejects.toBeInstanceOf(AssignmentError);
  });

  it("rejects when storage is not configured", async () => {
    vi.mocked(isStorageConfigured).mockReturnValue(false);
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("File storage is not configured.");
  });

  it("rolls back submission on upload failure", async () => {
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: "Upload failed.", storedKeys: [] });
    await expect(
      submitAssignment({
        courseId: "course_1",
        assignmentId: "asgn_1",
        actor: student,
        files: pdfFiles(),
      }),
    ).rejects.toThrow("Upload failed.");
    expect(db.deleteSubmission).toHaveBeenCalledWith("sub_1");
  });
});
