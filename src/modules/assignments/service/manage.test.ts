import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentError } from "./errors";

vi.mock("../db/repository", () => ({
  createAssignment: vi.fn(),
  deleteAssignmentRecord: vi.fn(),
  rollbackAssignmentRecord: vi.fn(),
  createAssignmentFiles: vi.fn(),
  findAssignmentInCourse: vi.fn(),
  findSubmission: vi.fn(),
  findLatestSubmission: vi.fn(),
  updateSubmissionGrade: vi.fn(),
  findAssignmentWithFiles: vi.fn(),
}));

vi.mock("@/lib/assignment-files", () => ({
  collectFormFiles: vi.fn(),
  prepareUploadedFiles: vi.fn(),
  storeAssignmentUploads: vi.fn(),
  validateAssignmentUploads: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  isStorageConfigured: vi.fn(() => true),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock("@/lib/subject-scope", () => ({
  assertWritableSubject: vi.fn(async () => "subj_1"),
}));

vi.mock("@/lib/time", () => ({
  parseDateInput: vi.fn((v: string) => new Date(v)),
}));

import * as db from "../db/repository";
import {
  validateAssignmentUploads,
  prepareUploadedFiles,
  storeAssignmentUploads,
} from "@/lib/assignment-files";
import { isStorageConfigured, deleteObject } from "@/lib/storage";
import type { Session } from "next-auth";
import { createAssignment, gradeSubmission, deleteAssignment } from "./manage";

const teacher = {
  user: {
    id: "teacher_1",
    kind: "staff" as const,
    roles: [],
    permissions: [],
    name: "Teacher",
    email: "t@example.com",
  },
} as unknown as Session;


// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

describe("createAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAssignmentUploads).mockReturnValue(null);
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(prepareUploadedFiles).mockReturnValue([
      { file: new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" }), fileName: "a.pdf" },
    ]);
    vi.mocked(db.createAssignment).mockResolvedValue({ id: "asgn_1" } as never);
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: null, storedKeys: ["key_1"] });
    vi.mocked(db.createAssignmentFiles).mockResolvedValue({ count: 1 } as never);
  });

  it("creates assignment and files", async () => {
    const pdf = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
    const result = await createAssignment({
      subjectId: "subj_1",
      title: "  Essay  ",
      instructions: "  Write well  ",
      dueRaw: "2026-12-01",
      maxMarks: 50,
      files: [pdf],
      actorId: "teacher_1",
    });
    expect(result).toEqual({ assignmentId: "asgn_1", subjectId: "subj_1" });
    expect(db.createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subj_1", title: "Essay", instructions: "Write well" }),
    );
    expect(db.createAssignmentFiles).toHaveBeenCalled();
  });

  it("rejects empty title", async () => {
    await expect(
      createAssignment({
        subjectId: "subj_1",
        title: "   ",
        instructions: null,
        dueRaw: null,
        maxMarks: 10,
        files: [new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" })],
        actorId: "teacher_1",
      }),
    ).rejects.toThrow("Title is required.");
  });

  it("rejects invalid maxMarks", async () => {
    await expect(
      createAssignment({
        subjectId: "subj_1",
        title: "X",
        instructions: null,
        dueRaw: null,
        maxMarks: 0,
        files: [new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" })],
        actorId: "teacher_1",
      }),
    ).rejects.toThrow("Maximum marks must be at least 1.");
  });

  it("rejects invalid uploads", async () => {
    vi.mocked(validateAssignmentUploads).mockReturnValue("Upload at least one PDF, image, audio, or video file.");
    await expect(
      createAssignment({
        subjectId: "subj_1",
        title: "X",
        instructions: null,
        dueRaw: null,
        maxMarks: 10,
        files: [],
        actorId: "teacher_1",
      }),
    ).rejects.toThrow("Upload at least one PDF, image, audio, or video file.");
  });

  it("rejects when storage is not configured", async () => {
    vi.mocked(isStorageConfigured).mockReturnValue(false);
    await expect(
      createAssignment({
        subjectId: "subj_1",
        title: "X",
        instructions: null,
        dueRaw: null,
        maxMarks: 10,
        files: [new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" })],
        actorId: "teacher_1",
      }),
    ).rejects.toThrow("File storage is not configured.");
  });

  it("rolls back assignment when file upload fails", async () => {
    vi.mocked(storeAssignmentUploads).mockResolvedValue({ error: "Upload failed.", storedKeys: [] });
    await expect(
      createAssignment({
        subjectId: "subj_1",
        title: "X",
        instructions: null,
        dueRaw: null,
        maxMarks: 10,
        files: [new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" })],
        actorId: "teacher_1",
      }),
    ).rejects.toThrow("Upload failed.");
    expect(db.rollbackAssignmentRecord).toHaveBeenCalledWith("asgn_1");
  });
});

// ---------------------------------------------------------------------------
// gradeSubmission
// ---------------------------------------------------------------------------

describe("gradeSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.findAssignmentInCourse).mockResolvedValue({
      id: "asgn_1",
      maxMarks: 100,
      subjectId: "subj_1",
    });
    vi.mocked(db.updateSubmissionGrade).mockResolvedValue({} as never);
  });

  it("grades a specific submission", async () => {
    vi.mocked(db.findSubmission).mockResolvedValue({ id: "sub_1", attemptNumber: 1 });
    const result = await gradeSubmission({
      courseId: "course_1",
      assignmentId: "asgn_1",
      studentId: "stu_1",
      submissionId: "sub_1",
      marks: 85,
      feedback: "Good",
      actor: teacher,
    });
    expect(result).toEqual({ attemptNumber: 1, subjectId: "subj_1" });
    expect(db.updateSubmissionGrade).toHaveBeenCalledWith("sub_1", {
      marks: 85,
      feedback: "Good",
      gradedById: "teacher_1",
    });
  });

  it("falls back to latest submission when submissionId is null", async () => {
    vi.mocked(db.findLatestSubmission).mockResolvedValue({ id: "sub_2", attemptNumber: 2 });
    const result = await gradeSubmission({
      courseId: "course_1",
      assignmentId: "asgn_1",
      studentId: "stu_1",
      submissionId: null,
      marks: 90,
      feedback: null,
      actor: teacher,
    });
    expect(result.attemptNumber).toBe(2);
    expect(db.findLatestSubmission).toHaveBeenCalledWith("asgn_1", "stu_1");
  });

  it("throws when assignment is missing", async () => {
    vi.mocked(db.findAssignmentInCourse).mockResolvedValue(null);
    await expect(
      gradeSubmission({
        courseId: "course_1",
        assignmentId: "missing",
        studentId: "stu_1",
        submissionId: null,
        marks: 50,
        feedback: null,
        actor: teacher,
      }),
    ).rejects.toThrow("That assignment was not found.");
  });

  it("throws when student has not submitted", async () => {
    vi.mocked(db.findLatestSubmission).mockResolvedValue(null);
    await expect(
      gradeSubmission({
        courseId: "course_1",
        assignmentId: "asgn_1",
        studentId: "stu_1",
        submissionId: null,
        marks: 50,
        feedback: null,
        actor: teacher,
      }),
    ).rejects.toThrow("This student has not submitted yet.");
  });

  it("rejects marks out of range", async () => {
    vi.mocked(db.findLatestSubmission).mockResolvedValue({ id: "sub_1", attemptNumber: 1 });
    await expect(
      gradeSubmission({
        courseId: "course_1",
        assignmentId: "asgn_1",
        studentId: "stu_1",
        submissionId: null,
        marks: 101,
        feedback: null,
        actor: teacher,
      }),
    ).rejects.toThrow("Marks must be between 0 and 100.");
  });
});

// ---------------------------------------------------------------------------
// deleteAssignment
// ---------------------------------------------------------------------------

describe("deleteAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes assignment and storage keys", async () => {
    vi.mocked(db.findAssignmentWithFiles).mockResolvedValue({
      id: "asgn_1",
      subjectId: "subj_1",
      files: [{ storageKey: "k1" }],
      submissions: [{ files: [{ storageKey: "k2" }] }],
    } as never);
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(deleteObject).mockResolvedValue(undefined);
    vi.mocked(db.deleteAssignmentRecord).mockResolvedValue({} as never);

    const result = await deleteAssignment({ courseId: "course_1", assignmentId: "asgn_1", actor: teacher });
    expect(result).toEqual({ subjectId: "subj_1" });
    expect(deleteObject).toHaveBeenCalledWith("k1");
    expect(deleteObject).toHaveBeenCalledWith("k2");
    expect(db.deleteAssignmentRecord).toHaveBeenCalledWith("asgn_1");
  });

  it("throws when assignment is missing", async () => {
    vi.mocked(db.findAssignmentWithFiles).mockResolvedValue(null);
    await expect(
      deleteAssignment({ courseId: "course_1", assignmentId: "missing", actor: teacher }),
    ).rejects.toThrow("That assignment was not found.");
  });

  it("skips storage cleanup when not configured", async () => {
    vi.mocked(db.findAssignmentWithFiles).mockResolvedValue({
      id: "asgn_1",
      subjectId: "subj_1",
      files: [{ storageKey: "k1" }],
      submissions: [],
    } as never);
    vi.mocked(isStorageConfigured).mockReturnValue(false);
    vi.mocked(db.deleteAssignmentRecord).mockResolvedValue({} as never);

    await deleteAssignment({ courseId: "course_1", assignmentId: "asgn_1", actor: teacher });
    expect(deleteObject).not.toHaveBeenCalled();
    expect(db.deleteAssignmentRecord).toHaveBeenCalledWith("asgn_1");
  });
});
