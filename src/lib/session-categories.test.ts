import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_CATEGORY_NAME,
  groupSessionsByCategory,
  parseAllowsResources,
  resolveCategoryTab,
  sessionCategoryTabs,
  sessionResourceUploadError,
} from "@/lib/session-categories";

describe("groupSessionsByCategory", () => {
  it("groups sessions and puts Class first", () => {
    const groups = groupSessionsByCategory([
      { id: "k1", category: { id: "cat_k", name: "Kirtana" } },
      { id: "c1", category: { id: "cat_c", name: DEFAULT_SESSION_CATEGORY_NAME } },
      { id: "k2", category: { id: "cat_k", name: "Kirtana" } },
    ]);

    expect(groups.map((group) => group.name)).toEqual([DEFAULT_SESSION_CATEGORY_NAME, "Kirtana"]);
    expect(groups[0].sessions.map((item) => item.id)).toEqual(["c1"]);
    expect(groups[1].sessions.map((item) => item.id)).toEqual(["k1", "k2"]);
  });
});

describe("resolveCategoryTab", () => {
  const tabs = [
    { id: "class", name: DEFAULT_SESSION_CATEGORY_NAME },
    { id: "kirtana", name: "Kirtana" },
  ];

  it("uses the requested tab when it exists, otherwise Class", () => {
    expect(resolveCategoryTab(tabs, "kirtana")?.id).toBe("kirtana");
    expect(resolveCategoryTab(tabs, "missing")?.id).toBe("class");
  });
});

describe("sessionCategoryTabs", () => {
  it("keeps only categories that already have sessions on the course batch", () => {
    const groups = groupSessionsByCategory([
      { id: "c1", category: { id: "cat_c", name: DEFAULT_SESSION_CATEGORY_NAME } },
      { id: "old", category: { id: "cat_old", name: "Temple" } },
    ]);

    expect(sessionCategoryTabs(groups).map((tab) => tab.name)).toEqual([
      DEFAULT_SESSION_CATEGORY_NAME,
      "Temple",
    ]);
    expect(sessionCategoryTabs(groups).some((tab) => tab.name === "Kirtana")).toBe(false);
  });
});

describe("parseAllowsResources", () => {
  it("is true when the checkbox is present, false when absent", () => {
    const on = new FormData();
    on.set("allowsResources", "on");
    expect(parseAllowsResources(on)).toBe(true);
    expect(parseAllowsResources(new FormData())).toBe(false);
  });
});

describe("sessionResourceUploadError", () => {
  it("refuses upload when the category does not allow session files", () => {
    expect(sessionResourceUploadError(true)).toBeNull();
    expect(sessionResourceUploadError(false)).toBe("This category does not allow session files.");
  });
});
