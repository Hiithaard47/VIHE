import { describe, it, expect } from "vitest";
import { parsePolicyForm } from "@/lib/policy";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parsePolicyForm", () => {
  it("parses a full policy", () => {
    const result = parsePolicyForm(
      form({
        defaultStatus: "ABSENT",
        lateCountsAsAttended: "on",
        lockAfterDays: "7",
      }),
    );
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      defaultStatus: "ABSENT",
      lateCountsAsAttended: true,
      excusedCountsAsAttended: false,
      lockAfterDays: 7,
    });
  });

  it("treats blank optional numbers as null, not zero", () => {
    const result = parsePolicyForm(form({ defaultStatus: "PRESENT", lockAfterDays: "" }));
    expect(result.success).toBe(true);
    expect(result.success && result.data.lockAfterDays).toBeNull();
  });

  it("rejects a negative lock window", () => {
    const result = parsePolicyForm(form({ defaultStatus: "PRESENT", lockAfterDays: "-1" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = parsePolicyForm(form({ defaultStatus: "TARDY" }));
    expect(result.success).toBe(false);
  });
});
