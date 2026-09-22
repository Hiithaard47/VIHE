import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { HomeworkError } from "./errors";

vi.mock("../db/repository", () => ({
  findSessionForHomework: vi.fn(),
  findSessionInCourse: vi.fn(),
  createSessionHomework: vi.fn(),
  findHomeworkWithSubmissionFiles: vi.fn(),
  deleteSessionHomework: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  canManageSubject: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  isStorageConfigured: vi.fn(() => false),
  deleteObject: vi.fn(async () => undefined),
}));

import * as db from "../db/repository";
import { canManageSubject } from "@/lib/rbac";
import { isStorageConfigured, deleteObject } from "@/lib/storage";
import {
  assignHomework,
  assignHomeworkForCourse,
  findSessionRef,
  loadManageableSession,
  removeHomework,
} from "./assign";

const teacher = {
  user: {
    id: "teacher_1",
    kind: "staff" as const,
    roles: ["Teacher"],
    permissions: [PERMISSIONS.SESSIONS_MANAGE],
    name: "Teacher",
    email: "t@example.com",
  },
} as unknown as Session;

const sessionRef = {
  id: "sess_1",
  subjectId: "subj_1",
  subject: { courseId: "course_1" },
  homework: null as { id: string } | null,
};

describe("loadManageableSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when session is missing", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue(null);
    await expect(loadManageableSession("missing", teacher)).rejects.toThrow(HomeworkError);
    await expect(loadManageableSession("missing", teacher)).rejects.toThrow("That session was not found.");
  });

  it("throws when actor cannot manage", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    vi.mocked(canManageSubject).mockResolvedValue(false);
    await expect(loadManageableSession("sess_1", teacher)).rejects.toThrow(
      "You cannot manage homework for this session.",
    );
  });

  it("returns session when actor can manage", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    vi.mocked(canManageSubject).mockResolvedValue(true);
    await expect(loadManageableSession("sess_1", teacher)).resolves.toEqual(sessionRef);
  });
});

describe("assignHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    vi.mocked(canManageSubject).mockResolvedValue(true);
    vi.mocked(db.createSessionHomework).mockResolvedValue({ id: "hw_1" } as never);
  });

  it("creates homework and returns course/subject ids", async () => {
    const result = await assignHomework({
      sessionId: "sess_1",
      title: "  Reading  ",
      instructions: "  do it  ",
      actor: teacher,
    });
    expect(result).toEqual({ courseId: "course_1", subjectId: "subj_1" });
    expect(db.createSessionHomework).toHaveBeenCalledWith({
      sessionId: "sess_1",
      title: "Reading",
      instructions: "do it",
      createdById: "teacher_1",
    });
  });

  it("rejects empty title", async () => {
    await expect(
      assignHomework({ sessionId: "sess_1", title: "   ", instructions: null, actor: teacher }),
    ).rejects.toThrow("Title is required.");
  });

  it("maps unique constraint races to already-has-homework", async () => {
    const { Prisma } = await import("@prisma/client");
    vi.mocked(db.createSessionHomework).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "test" }),
    );
    await expect(
      assignHomework({ sessionId: "sess_1", title: "X", instructions: null, actor: teacher }),
    ).rejects.toThrow("This session already has homework.");
  });
});

describe("assignHomeworkForCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canManageSubject).mockResolvedValue(true);
    vi.mocked(db.createSessionHomework).mockResolvedValue({ id: "hw_1" } as never);
  });

  it("requires a session id", async () => {
    await expect(
      assignHomeworkForCourse({
        courseId: "course_1",
        sessionId: "",
        title: "X",
        instructions: null,
        actor: teacher,
      }),
    ).rejects.toThrow("Choose a session.");
  });

  it("rejects session outside the course", async () => {
    vi.mocked(db.findSessionInCourse).mockResolvedValue(null);
    await expect(
      assignHomeworkForCourse({
        courseId: "course_1",
        sessionId: "sess_1",
        title: "X",
        instructions: null,
        actor: teacher,
      }),
    ).rejects.toThrow("That session was not found.");
  });

  it("assigns when session belongs to course", async () => {
    vi.mocked(db.findSessionInCourse).mockResolvedValue({ id: "sess_1", subjectId: "subj_1" });
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    const result = await assignHomeworkForCourse({
      courseId: "course_1",
      sessionId: "sess_1",
      title: "X",
      instructions: null,
      actor: teacher,
    });
    expect(result).toEqual({ courseId: "course_1", subjectId: "subj_1", sessionId: "sess_1" });
  });
});

describe("removeHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canManageSubject).mockResolvedValue(true);
  });

  it("throws when session has no homework", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    await expect(removeHomework({ sessionId: "sess_1", actor: teacher })).rejects.toThrow(
      "This session has no homework.",
    );
  });

  it("deletes homework and storage keys when configured", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue({
      ...sessionRef,
      homework: { id: "hw_1" },
    });
    vi.mocked(db.findHomeworkWithSubmissionFiles).mockResolvedValue({
      id: "hw_1",
      submissions: [{ files: [{ storageKey: "k1" }] }],
    } as never);
    vi.mocked(isStorageConfigured).mockReturnValue(true);
    vi.mocked(deleteObject).mockResolvedValue(undefined);
    vi.mocked(db.deleteSessionHomework).mockResolvedValue({} as never);

    const result = await removeHomework({ sessionId: "sess_1", actor: teacher });
    expect(result).toEqual({ courseId: "course_1", subjectId: "subj_1" });
    expect(deleteObject).toHaveBeenCalledWith("k1");
    expect(db.deleteSessionHomework).toHaveBeenCalledWith("hw_1");
  });
});

describe("findSessionRef", () => {
  it("delegates to the repository", async () => {
    vi.mocked(db.findSessionForHomework).mockResolvedValue(sessionRef);
    await expect(findSessionRef("sess_1")).resolves.toEqual(sessionRef);
    expect(db.findSessionForHomework).toHaveBeenCalledWith("sess_1");
  });
});
