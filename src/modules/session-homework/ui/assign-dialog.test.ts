import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  assignSessionHomework: vi.fn(),
}));

vi.mock("@/lib/dialog", () => ({
  openDialog: vi.fn(),
}));

import { AssignSessionHomeworkDialog } from "./assign-dialog";

describe("AssignSessionHomeworkDialog", () => {
  it("exports a client component function", () => {
    expect(typeof AssignSessionHomeworkDialog).toBe("function");
  });
});
