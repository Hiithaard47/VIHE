import { describe, it, expect } from "vitest";
import { parseDetailsForm } from "@/modules/courses/service/course-details";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseDetailsForm", () => {
  it("trims name and code and treats blank description as empty", () => {
    const result = parseDetailsForm(form({ name: "  Kirtan  ", code: " BSA ", loginMonths: "6" }));
    expect(result.success).toBe(true);
    expect(result.success && result.data).toMatchObject({
      name: "Kirtan",
      code: "BSA",
      description: "",
      loginMonths: 6,
    });
  });

  it("rejects a missing name", () => {
    const result = parseDetailsForm(form({ name: "   ", code: "BSA", loginMonths: "" }));
    expect(result.success).toBe(false);
  });
});
