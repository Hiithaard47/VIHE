import { describe, expect, it } from "vitest";
import { parseCsv, recordsFromCsv, requireColumns } from "./csv";

describe("csv", () => {
  it("parses quoted commas and headers into records", () => {
    const text = 'name,email\n"Doe, Jane",jane@example.com\n';
    expect(parseCsv(text)).toEqual([
      ["name", "email"],
      ["Doe, Jane", "jane@example.com"],
    ]);
    expect(recordsFromCsv(text)).toEqual({
      headers: ["name", "email"],
      rows: [{ name: "Doe, Jane", email: "jane@example.com" }],
    });
  });

  it("reports missing required columns", () => {
    expect(requireColumns(["name", "email"], ["name", "password"])).toMatch(/password/);
    expect(requireColumns(["name", "email"], ["name", "email"])).toBeNull();
  });
});
