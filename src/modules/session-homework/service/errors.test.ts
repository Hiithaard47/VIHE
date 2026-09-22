import { describe, expect, it } from "vitest";
import { HomeworkError, isHomeworkError } from "./errors";

describe("HomeworkError", () => {
  it("sets name, message, and code", () => {
    const error = new HomeworkError("Title is required.", "validation");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("HomeworkError");
    expect(error.message).toBe("Title is required.");
    expect(error.code).toBe("validation");
  });
});

describe("isHomeworkError", () => {
  it("detects HomeworkError instances", () => {
    expect(isHomeworkError(new HomeworkError("x", "not_found"))).toBe(true);
    expect(isHomeworkError(new Error("x"))).toBe(false);
    expect(isHomeworkError("x")).toBe(false);
    expect(isHomeworkError(null)).toBe(false);
  });
});
