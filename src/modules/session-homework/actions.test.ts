import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { HomeworkError } from "./service/errors";

function redirectError(url: string) {
  const error = new Error(`NEXT_REDIRECT:${url}`);
  (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;${url}`;
  return error;
}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw redirectError(url);
  }),
}));

vi.mock("@/lib/rbac", () => ({
  requireSubjectAccess: vi.fn(),
  requireStudent: vi.fn(),
}));

vi.mock("./service/assign", () => ({
  findSessionRef: vi.fn(),
  assignHomework: vi.fn(),
  assignHomeworkForCourse: vi.fn(),
  removeHomework: vi.fn(),
}));

vi.mock("./service/submit", () => ({
  submitHomework: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent, requireSubjectAccess } from "@/lib/rbac";
import {
  assignHomework,
  assignHomeworkForCourse,
  findSessionRef,
  removeHomework,
} from "./service/assign";
import { submitHomework } from "./service/submit";
import {
  assignCourseHomework,
  assignSessionHomework,
  removeSessionHomework,
  submitSessionHomework,
} from "./actions";

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

const sessionRef = {
  id: "sess_1",
  subjectId: "subj_1",
  subject: { courseId: "course_1" },
  homework: null,
};

async function redirected(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error("expected redirect");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith("NEXT_REDIRECT:")) throw error;
    return message.slice("NEXT_REDIRECT:".length);
  }
}

describe("assignSessionHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSubjectAccess).mockResolvedValue(teacher);
  });

  it("redirects when session is missing", async () => {
    vi.mocked(findSessionRef).mockResolvedValue(null);
    const url = await redirected(assignSessionHomework("sess_1", "teacher", new FormData()));
    expect(url).toContain("/teacher/sessions/sess_1");
    expect(url).toContain("That+session+was+not+found");
  });

  it("assigns and redirects with success flash", async () => {
    vi.mocked(findSessionRef).mockResolvedValue(sessionRef);
    vi.mocked(assignHomework).mockResolvedValue({ courseId: "course_1", subjectId: "subj_1" });
    const formData = new FormData();
    formData.set("title", "Reading");
    formData.set("instructions", "Ch 1");

    const url = await redirected(assignSessionHomework("sess_1", "teacher", formData));
    expect(assignHomework).toHaveBeenCalledWith({
      sessionId: "sess_1",
      title: "Reading",
      instructions: "Ch 1",
      actor: teacher,
    });
    expect(revalidatePath).toHaveBeenCalled();
    expect(url).toContain("kind=success");
    expect(url).toContain("Homework+assigned");
  });

  it("maps HomeworkError to flash error", async () => {
    vi.mocked(findSessionRef).mockResolvedValue(sessionRef);
    vi.mocked(assignHomework).mockRejectedValue(new HomeworkError("Title is required."));
    const formData = new FormData();
    formData.set("title", "");
    const url = await redirected(assignSessionHomework("sess_1", "teacher", formData));
    expect(url).toContain("kind=error");
    expect(url).toContain("Title+is+required");
  });
});

describe("assignCourseHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSubjectAccess).mockResolvedValue(teacher);
  });

  it("requires a session selection", async () => {
    const url = await redirected(assignCourseHomework("course_1", "teacher", new FormData()));
    expect(url).toContain("/teacher/courses/course_1/homework");
    expect(url).toContain("Choose+a+session");
  });

  it("rejects session from another course", async () => {
    vi.mocked(findSessionRef).mockResolvedValue({
      ...sessionRef,
      subject: { courseId: "other" },
    });
    const formData = new FormData();
    formData.set("sessionId", "sess_1");
    const url = await redirected(assignCourseHomework("course_1", "teacher", formData));
    expect(url).toContain("That+session+was+not+found");
  });

  it("assigns for a course session", async () => {
    vi.mocked(findSessionRef).mockResolvedValue(sessionRef);
    vi.mocked(assignHomeworkForCourse).mockResolvedValue({
      courseId: "course_1",
      subjectId: "subj_1",
      sessionId: "sess_1",
    });
    const formData = new FormData();
    formData.set("sessionId", "sess_1");
    formData.set("title", "HW");
    const url = await redirected(assignCourseHomework("course_1", "admin", formData));
    expect(assignHomeworkForCourse).toHaveBeenCalled();
    expect(url).toContain("kind=success");
  });
});

describe("removeSessionHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSubjectAccess).mockResolvedValue(teacher);
    vi.mocked(findSessionRef).mockResolvedValue(sessionRef);
  });

  it("removes and flashes success", async () => {
    vi.mocked(removeHomework).mockResolvedValue({ courseId: "course_1", subjectId: "subj_1" });
    const url = await redirected(removeSessionHomework("sess_1", "teacher", new FormData()));
    expect(removeHomework).toHaveBeenCalledWith({ sessionId: "sess_1", actor: teacher });
    expect(url).toContain("Homework+removed");
  });
});

describe("submitSessionHomework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStudent).mockResolvedValue(student);
  });

  it("submits and flashes success", async () => {
    vi.mocked(submitHomework).mockResolvedValue({ updated: false });
    const url = await redirected(submitSessionHomework("course_1", "sess_1", new FormData()));
    expect(url).toContain("Homework+submitted");
  });

  it("flashes update when replacing", async () => {
    vi.mocked(submitHomework).mockResolvedValue({ updated: true });
    const url = await redirected(submitSessionHomework("course_1", "sess_1", new FormData()));
    expect(url).toContain("Homework+updated");
  });

  it("redirects unenrolled students to /student", async () => {
    vi.mocked(submitHomework).mockRejectedValue(
      new HomeworkError("You are not enrolled in this course.", "not_enrolled"),
    );
    const url = await redirected(submitSessionHomework("course_1", "sess_1", new FormData()));
    expect(url).toBe("/student");
    expect(redirect).toHaveBeenCalledWith("/student");
  });

  it("maps other homework errors to flash", async () => {
    vi.mocked(submitHomework).mockRejectedValue(
      new HomeworkError("Homework can only be submitted on the session day."),
    );
    const url = await redirected(submitSessionHomework("course_1", "sess_1", new FormData()));
    expect(url).toContain("kind=error");
    expect(url).toContain("session+day");
  });
});
