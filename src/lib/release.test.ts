import { describe, expect, it } from "vitest";
import { getReleaseTag } from "./release";

describe("getReleaseTag", () => {
  it("prefers RELEASE_TAG when set", () => {
    const previous = process.env.RELEASE_TAG;
    process.env.RELEASE_TAG = " v1.2.3 ";
    expect(getReleaseTag()).toBe("v1.2.3");
    process.env.RELEASE_TAG = previous;
  });

  it("falls back to package.json version", () => {
    const previous = process.env.RELEASE_TAG;
    delete process.env.RELEASE_TAG;
    expect(getReleaseTag()).toMatch(/^v\d+\.\d+\.\d+/);
    process.env.RELEASE_TAG = previous;
  });
});
