import { describe, expect, it } from "vitest";
import { AssignmentError, isAssignmentError } from "./errors";

describe("AssignmentError", () => {
  it("sets name, message, and code", () => {
    const error = new AssignmentError("Title is required.", "validation");
    expect(error.name).toBe("AssignmentError");
    expect(error.code).toBe("validation");
    expect(isAssignmentError(error)).toBe(true);
    expect(isAssignmentError(new Error("x"))).toBe(false);
  });
});
