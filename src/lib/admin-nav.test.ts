import { describe, expect, it } from "vitest";
import { ADMIN_NAV, ADMIN_SETTINGS_NAV, isAdminNavActive, isAdminSettingsActive } from "@/lib/admin-nav";

describe("isAdminNavActive", () => {
  it("matches dashboard only on the exact /admin path", () => {
    expect(isAdminNavActive("/admin", "/admin")).toBe(true);
    expect(isAdminNavActive("/admin/teachers", "/admin")).toBe(false);
    expect(isAdminNavActive("/admin/courses/abc", "/admin")).toBe(false);
  });

  it("highlights a section for its list and nested pages", () => {
    expect(isAdminNavActive("/admin/teachers", "/admin/teachers")).toBe(true);
    expect(isAdminNavActive("/admin/teachers/u1/roles", "/admin/teachers")).toBe(true);
    expect(isAdminNavActive("/admin/courses/c1/subjects/s1/sessions", "/admin/courses")).toBe(true);
    expect(isAdminNavActive("/admin/teachers", "/admin/courses")).toBe(false);
  });

  it("treats session detail as the Courses section", () => {
    expect(isAdminNavActive("/admin/sessions/s1", "/admin/courses")).toBe(true);
    expect(isAdminNavActive("/admin/sessions/s1", "/admin/session-categories")).toBe(false);
  });

  it("keeps session categories and roles under Settings, not the primary nav", () => {
    expect(ADMIN_NAV.map((item) => item.href)).toEqual(["/admin", "/admin/teachers", "/admin/courses", "/admin/students"]);
    expect(ADMIN_SETTINGS_NAV.map((item) => item.href)).toEqual(["/admin/session-categories", "/admin/roles"]);
    expect(isAdminSettingsActive("/admin/session-categories")).toBe(true);
    expect(isAdminSettingsActive("/admin/roles/r1")).toBe(true);
    expect(isAdminSettingsActive("/admin/teachers")).toBe(false);
  });
});
