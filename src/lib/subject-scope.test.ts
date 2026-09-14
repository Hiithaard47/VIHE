import { describe, it, expect } from "vitest";
import { subjectWhere, narrowScope, sessionWhere, writableSubjectId } from "@/lib/subject-scope";

describe("subjectWhere", () => {
  it("filters to the given subject ids", () => {
    expect(subjectWhere({ kind: "ids", ids: ["morning", "evening"] })).toEqual({
      id: { in: ["morning", "evening"] },
    });
  });

  it("returns an empty id filter when none are assigned", () => {
    expect(subjectWhere({ kind: "ids", ids: [] })).toEqual({ id: { in: [] } });
  });

  it("leaves admins on every active subject", () => {
    expect(subjectWhere({ kind: "all" })).toEqual({ isActive: true });
  });
});

describe("sessionWhere", () => {
  it("filters one or many assigned subjects", () => {
    expect(sessionWhere("c1", { kind: "ids", ids: ["morning"] })).toEqual({ subjectId: "morning" });
    expect(sessionWhere("c1", { kind: "ids", ids: ["morning", "evening"] })).toEqual({
      subjectId: { in: ["morning", "evening"] },
    });
  });

  it("lets admins see every subject on the course", () => {
    expect(sessionWhere("c1", { kind: "all" })).toEqual({ subject: { courseId: "c1" } });
  });
});

describe("narrowScope", () => {
  it("keeps the selected subject when it is in scope", () => {
    expect(narrowScope({ kind: "ids", ids: ["morning", "evening"] }, "evening")).toEqual({
      kind: "ids",
      ids: ["evening"],
    });
  });

  it("returns the original scope when no subject is selected", () => {
    expect(narrowScope({ kind: "all" }, null)).toEqual({ kind: "all" });
  });

  it("rejects a spoofed subject instead of falling back", () => {
    expect(narrowScope({ kind: "ids", ids: ["morning"] }, "evening")).toBeNull();
  });
});

describe("writableSubjectId", () => {
  it("requires the requested subject and rejects a spoof", () => {
    expect(writableSubjectId({ kind: "ids", ids: ["morning", "evening"] }, "evening")).toBe("evening");
    expect(writableSubjectId({ kind: "ids", ids: ["morning"] }, "evening")).toBeNull();
    expect(writableSubjectId({ kind: "ids", ids: ["morning"] }, null)).toBeNull();
    expect(writableSubjectId({ kind: "all" }, "evening")).toBe("evening");
    expect(writableSubjectId({ kind: "all" }, null)).toBeNull();
  });
});
