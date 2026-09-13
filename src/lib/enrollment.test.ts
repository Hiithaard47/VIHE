import { describe, it, expect } from "vitest";
import {
  narrowAssignedBatches,
  otherBatchEnrollmentWhere,
  pickWritableBatch,
  visibleBatchesWhere,
} from "@/lib/enrollment";

describe("otherBatchEnrollmentWhere", () => {
  it("targets the same student on sibling batches of the course", () => {
    expect(
      otherBatchEnrollmentWhere({
        studentId: "stu_1",
        courseId: "crs_1",
        exceptBatchId: "bat_morning",
      }),
    ).toEqual({
      studentId: "stu_1",
      batchId: { not: "bat_morning" },
      batch: { courseId: "crs_1" },
    });
  });
});

describe("pickWritableBatch", () => {
  it("lets a teacher write to any batch they are assigned to", () => {
    expect(pickWritableBatch(["morning", "evening"], "evening", "fallback")).toBe("evening");
  });

  it("keeps a teacher on an assigned batch when they omit a choice", () => {
    expect(pickWritableBatch(["morning", "evening"], null, "fallback")).toBe("morning");
  });

  it("rejects a spoofed batch the teacher does not teach", () => {
    expect(pickWritableBatch(["morning"], "evening", "fallback")).toBe("morning");
  });

  it("lets an unassigned admin use the requested or fallback batch", () => {
    expect(pickWritableBatch([], "evening", "fallback")).toBe("evening");
    expect(pickWritableBatch([], null, "fallback")).toBe("fallback");
  });
});

describe("visibleBatchesWhere", () => {
  it("shows every assigned batch instead of only the first", () => {
    expect(visibleBatchesWhere(["morning", "evening"])).toEqual({ id: { in: ["morning", "evening"] } });
  });

  it("leaves admins unscoped so they still see every active batch", () => {
    expect(visibleBatchesWhere([])).toEqual({ isActive: true });
  });
});

describe("narrowAssignedBatches", () => {
  it("scopes a teacher to the batch they opened from the course list", () => {
    expect(narrowAssignedBatches(["morning", "evening"], "evening")).toEqual(["evening"]);
  });

  it("keeps every assigned batch when the course is opened without a batch", () => {
    expect(narrowAssignedBatches(["morning", "evening"], null)).toEqual(["morning", "evening"]);
  });

  it("ignores a batch the teacher does not teach", () => {
    expect(narrowAssignedBatches(["morning"], "evening")).toEqual(["morning"]);
  });
});
