import { describe, expect, it } from "vitest";
import { displayUserName, displayUserNameFromRecord } from "@/lib/user-name";

describe("displayUserName", () => {
  it("prefers the full name", () => {
    expect(displayUserName({ name: "Parmod Kumar", email: "p@example.com" })).toBe("Parmod Kumar");
  });

  it("falls back to the email local part", () => {
    expect(displayUserName({ name: "  ", email: "teacher@example.com" })).toBe("teacher");
  });

  it("falls back to Account when nothing is set", () => {
    expect(displayUserName({ name: null, email: null })).toBe("Account");
  });
});

describe("displayUserNameFromRecord", () => {
  it("uses the live row even when the session still has an email prefix", () => {
    expect(
      displayUserNameFromRecord(
        { name: null, email: "admin@example.com" },
        { name: "Admin User", email: "admin@example.com" },
      ),
    ).toBe("Admin User");
  });

  it("uses the live row when the JWT name is stale", () => {
    expect(
      displayUserNameFromRecord(
        { name: "admin", email: "admin@example.com" },
        { name: "Admin User", email: "admin@example.com" },
      ),
    ).toBe("Admin User");
  });

  it("falls back to the session when the row is missing", () => {
    expect(
      displayUserNameFromRecord({ name: "Admin User", email: "admin@example.com" }, null),
    ).toBe("Admin User");
  });
});
