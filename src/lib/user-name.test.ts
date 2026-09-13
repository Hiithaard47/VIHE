import { describe, expect, it } from "vitest";
import { displayUserName } from "@/lib/user-name";

describe("displayUserName", () => {
  it("prefers the full name", () => {
    expect(displayUserName({ name: "Parmod Kumar", email: "p@example.com" })).toBe("Parmod Kumar");
  });

  it("falls back to the email local part", () => {
    expect(displayUserName({ name: "  ", email: "teacher@example.com" })).toBe("teacher");
  });
});
