import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { AttendanceError } from "./errors";
import { startOfTodayUtc, addUtcDays } from "@/lib/time";

vi.mock("../db/repository", () => ({
  findSessionForMarking: vi.fn(),
  listCourseEnrollmentStudentIds: vi.fn(),
  upsertAttendanceMarks: vi.fn(),
}));

import * as db from "../db/repository";
import { markSessionAttendance, parseAttendanceFormStatuses } from "./mark";

const actor = {
  user: { id: "teacher_1", kind: "staff", roles: [], permissions: [], name: "T", email: "t@x.com" },
} as unknown as Session;

function sessionRef(overrides: Partial<{ date: Date; lockAfterDays: number | null }> = {}) {
  return {
    id: "s1",
    subjectId: "subj",
    date: overrides.date ?? startOfTodayUtc(),
    subject: {
      courseId: "c1",
      course: { lockAfterDays: overrides.lockAfterDays ?? null },
    },
  };
}

describe("parseAttendanceFormStatuses", () => {
  it("reads status:studentId fields", () => {
    const formData = new FormData();
    formData.set("status:stu_1", "PRESENT");
    formData.set("status:stu_2", "ABSENT");
    formData.set("other", "x");
    expect(parseAttendanceFormStatuses(formData)).toEqual({
      stu_1: "PRESENT",
      stu_2: "ABSENT",
    });
  });
});

describe("markSessionAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when attendance is locked", async () => {
    await expect(
      markSessionAttendance({
        classSession: sessionRef({ date: addUtcDays(startOfTodayUtc(), -10), lockAfterDays: 2 }),
        actor,
        statuses: {},
      }),
    ).rejects.toThrow("Attendance is locked for this session.");
  });

  it("upserts only valid enrolled statuses", async () => {
    vi.mocked(db.listCourseEnrollmentStudentIds).mockResolvedValue([
      { studentId: "stu_1" },
      { studentId: "stu_2" },
    ]);
    vi.mocked(db.upsertAttendanceMarks).mockResolvedValue(undefined);

    await markSessionAttendance({
      classSession: sessionRef(),
      actor,
      statuses: { stu_1: "PRESENT", stu_2: "NOPE", stranger: "ABSENT" },
    });

    expect(db.upsertAttendanceMarks).toHaveBeenCalledWith("s1", "teacher_1", [
      { studentId: "stu_1", status: "PRESENT" },
    ]);
  });

  it("skips db write when no valid marks", async () => {
    vi.mocked(db.listCourseEnrollmentStudentIds).mockResolvedValue([{ studentId: "stu_1" }]);
    await markSessionAttendance({ classSession: sessionRef(), actor, statuses: {} });
    expect(db.upsertAttendanceMarks).toHaveBeenCalledWith("s1", "teacher_1", []);
  });
});
