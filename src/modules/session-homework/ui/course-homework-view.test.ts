import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Session } from "next-auth";
import { PERMISSIONS } from "@/lib/permissions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/rbac", () => ({
  loadCourseWorkspace: vi.fn(),
}));

vi.mock("../service/queries", () => ({
  getCourseHomeworkList: vi.fn(),
}));

vi.mock("../actions", () => ({
  assignCourseHomework: vi.fn(),
  removeSessionHomework: vi.fn(),
}));

import { loadCourseWorkspace } from "@/lib/rbac";
import { getCourseHomeworkList } from "../service/queries";
import { CourseHomeworkView } from "./course-homework-view";

const teacher = {
  user: {
    id: "teacher_1",
    kind: "staff" as const,
    roles: ["Teacher"],
    permissions: [PERMISSIONS.SESSIONS_MANAGE, PERMISSIONS.COURSES_READ],
    name: "Teacher",
    email: "t@example.com",
  },
} as unknown as Session;

describe("CourseHomeworkView", () => {
  it("renders assign form and existing homework", async () => {
    vi.mocked(loadCourseWorkspace).mockResolvedValue({
      session: teacher,
      scope: { kind: "all" },
      canManage: true,
      canConfigure: true,
    });
    vi.mocked(getCourseHomeworkList).mockResolvedValue({
      sessions: [],
      enrollmentCount: 2,
      withHomework: [
        {
          id: "s1",
          name: "Session A",
          date: new Date("2026-09-22T00:00:00.000Z"),
          subject: { id: "subj", name: "Math" },
          homework: { id: "hw1", title: "Essay", _count: { submissions: 1 } },
        },
      ],
      withoutHomework: [
        {
          id: "s2",
          name: "Session B",
          date: new Date("2026-09-23T00:00:00.000Z"),
          subject: { id: "subj", name: "Math" },
          homework: null,
        },
      ],
    } as never);

    const element = await CourseHomeworkView({
      courseId: "course_1",
      portal: "teacher",
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Assign homework");
    expect(html).toContain("Session B");
    expect(html).toContain("Essay");
    expect(html).toContain("1/2 submitted");
  });
});
