import { describe, expect, it } from "vitest";
import { hashPassword, passwordMatches, validateNewPassword } from "@/lib/password";

describe("validateNewPassword", () => {
  it("requires eight characters and a matching confirmation", () => {
    expect(validateNewPassword("short", "short")).toBe("Password must be at least 8 characters.");
    expect(validateNewPassword("LongEnough1", "LongEnough2")).toBe("Passwords do not match.");
    expect(validateNewPassword("LongEnough1", "LongEnough1")).toBeNull();
  });
});

describe("hashPassword", () => {
  it("hashes a value that passwordMatches accepts", async () => {
    const hash = await hashPassword("LongEnough1");
    expect(await passwordMatches("LongEnough1", hash)).toBe(true);
    expect(await passwordMatches("wrong-pass", hash)).toBe(false);
  });
});
