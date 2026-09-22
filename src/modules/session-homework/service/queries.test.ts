import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/repository", () => ({
  listCourseHomeworkSessions: vi.fn(),
  countCourseEnrollments: vi.fn(),
  listStudentCourseHomework: vi.fn(),
  findSubmissionFileForDownload: vi.fn(),
}));

import * as db from "../db/repository";
import {
  getCourseHomeworkList,
  getStudentCourseHomework,
  getSubmissionFileForDownload,
} from "./queries";

describe("getCourseHomeworkList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("splits sessions with and without homework", async () => {
    vi.mocked(db.listCourseHomeworkSessions).mockResolvedValue([
      {
        id: "s1",
        name: "A",
        date: new Date("2026-01-01"),
        subject: { id: "subj", name: "Math" },
        homework: { id: "hw1", title: "T", _count: { submissions: 1 } },
      },
      {
        id: "s2",
        name: "B",
        date: new Date("2026-01-02"),
        subject: { id: "subj", name: "Math" },
        homework: null,
      },
    ] as never);
    vi.mocked(db.countCourseEnrollments).mockResolvedValue(12);

    const result = await getCourseHomeworkList("course_1", { kind: "all" });
    expect(result.enrollmentCount).toBe(12);
    expect(result.withHomework).toHaveLength(1);
    expect(result.withoutHomework).toHaveLength(1);
    expect(db.listCourseHomeworkSessions).toHaveBeenCalledWith({ subject: { courseId: "course_1" } });
  });
});

describe("getStudentCourseHomework", () => {
  it("splits pending and submitted", async () => {
    vi.mocked(db.listStudentCourseHomework).mockResolvedValue([
      {
        id: "hw1",
        title: "Pending one",
        session: { id: "s1", name: "S1", date: new Date() },
        submissions: [],
      },
      {
        id: "hw2",
        title: "Done",
        session: { id: "s2", name: "S2", date: new Date() },
        submissions: [{ id: "sub", submittedAt: new Date() }],
      },
    ] as never);

    const result = await getStudentCourseHomework("course_1", "stu_1");
    expect(result.pending.map((item) => item.id)).toEqual(["hw1"]);
    expect(result.submitted.map((item) => item.id)).toEqual(["hw2"]);
  });
});

describe("getSubmissionFileForDownload", () => {
  it("delegates to the repository", async () => {
    const file = { fileName: "a.pdf", storageKey: "k" };
    vi.mocked(db.findSubmissionFileForDownload).mockResolvedValue(file as never);
    await expect(getSubmissionFileForDownload("file_1")).resolves.toEqual(file);
    expect(db.findSubmissionFileForDownload).toHaveBeenCalledWith("file_1");
  });
});
