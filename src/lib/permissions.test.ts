import { describe, it, expect } from "vitest";
import { PERMISSIONS, PERMISSION_DEFINITIONS, DEFAULT_ROLES } from "@/lib/permissions";

describe("permission registry", () => {
  it("defines every PERMISSIONS value in PERMISSION_DEFINITIONS", () => {
    const defined = PERMISSION_DEFINITIONS.map((p) => p.key);
    for (const key of Object.values(PERMISSIONS)) {
      expect(defined).toContain(key);
    }
  });

  it("grants courses.configure to the Teacher role by default", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).toContain(PERMISSIONS.COURSES_CONFIGURE);
  });

  it("keeps courses.manage out of the Teacher role", () => {
    const teacher = DEFAULT_ROLES.find((r) => r.name === "Teacher");
    expect(teacher?.permissions).not.toContain(PERMISSIONS.COURSES_MANAGE);
  });
});
