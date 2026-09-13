import { describe, expect, it } from "vitest";
import { batchWhere, narrowScope, sessionWhere, writableBatchId } from "@/lib/batch-scope";

describe("batchWhere", () => {
  it("scopes teachers to assigned ids", () => {
    expect(batchWhere({ kind: "ids", ids: ["morning", "evening"] })).toEqual({
      id: { in: ["morning", "evening"] },
    });
  });

  it("does not treat an empty id list as admin", () => {
    expect(batchWhere({ kind: "ids", ids: [] })).toEqual({ id: { in: [] } });
  });

  it("leaves admins on every active batch", () => {
    expect(batchWhere({ kind: "all" })).toEqual({ isActive: true });
  });
});

describe("sessionWhere", () => {
  it("filters one or many assigned batches", () => {
    expect(sessionWhere("c1", { kind: "ids", ids: ["morning"] })).toEqual({ batchId: "morning" });
    expect(sessionWhere("c1", { kind: "ids", ids: ["morning", "evening"] })).toEqual({
      batchId: { in: ["morning", "evening"] },
    });
  });

  it("does not open the whole course when ids are empty", () => {
    expect(sessionWhere("c1", { kind: "ids", ids: [] })).toEqual({ id: { in: [] } });
  });

  it("lets admins see every batch on the course", () => {
    expect(sessionWhere("c1", { kind: "all" })).toEqual({ batch: { courseId: "c1" } });
  });
});

describe("narrowScope", () => {
  it("keeps the selected batch when it is in scope", () => {
    expect(narrowScope({ kind: "ids", ids: ["morning", "evening"] }, "evening")).toEqual({
      kind: "ids",
      ids: ["evening"],
    });
    expect(narrowScope({ kind: "all" }, "evening")).toEqual({ kind: "ids", ids: ["evening"] });
  });

  it("returns the original scope when no batch is selected", () => {
    expect(narrowScope({ kind: "ids", ids: ["morning", "evening"] }, null)).toEqual({
      kind: "ids",
      ids: ["morning", "evening"],
    });
  });

  it("rejects a spoofed batch instead of falling back", () => {
    expect(narrowScope({ kind: "ids", ids: ["morning"] }, "evening")).toBeNull();
  });
});

describe("writableBatchId", () => {
  it("requires the requested batch and rejects a spoof", () => {
    expect(writableBatchId({ kind: "ids", ids: ["morning", "evening"] }, "evening")).toBe("evening");
    expect(writableBatchId({ kind: "ids", ids: ["morning"] }, "evening")).toBeNull();
    expect(writableBatchId({ kind: "ids", ids: ["morning"] }, null)).toBeNull();
    expect(writableBatchId({ kind: "all" }, "evening")).toBe("evening");
    expect(writableBatchId({ kind: "all" }, null)).toBeNull();
  });
});
