import { describe, expect, it } from "vitest";
import { AttendanceError, isAttendanceError } from "./errors";

describe("AttendanceError", () => {
  it("sets name and message", () => {
    const error = new AttendanceError("Attendance is locked for this session.");
    expect(error.name).toBe("AttendanceError");
    expect(isAttendanceError(error)).toBe(true);
    expect(isAttendanceError(new Error("x"))).toBe(false);
  });
});
