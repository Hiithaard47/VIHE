import { describe, expect, it } from "vitest";
import {
  azureRevisionSuffix,
  bumpFromCommits,
  decideRelease,
  isAppChangePath,
  nextSemver,
  parseForceBump,
} from "./release-gate";

describe("isAppChangePath", () => {
  it("matches runtime paths and ignores CI/docs", () => {
    expect(isAppChangePath("src/lib/release.ts")).toBe(true);
    expect(isAppChangePath("prisma/schema.prisma")).toBe(true);
    expect(isAppChangePath("next.config.mjs")).toBe(true);
    expect(isAppChangePath("Dockerfile")).toBe(true);
    expect(isAppChangePath("package.json")).toBe(true);
    expect(isAppChangePath("scripts/start-prod.sh")).toBe(true);
    expect(isAppChangePath(".github/workflows/ci.yml")).toBe(false);
    expect(isAppChangePath("playwright.config.ts")).toBe(false);
    expect(isAppChangePath("README.md")).toBe(false);
  });
});

describe("bumpFromCommits", () => {
  it("maps feat / fix / breaking subject", () => {
    expect(bumpFromCommits(["feat: add print"])).toBe("minor");
    expect(bumpFromCommits(["feat(attendance): add print"])).toBe("minor");
    expect(bumpFromCommits(["fix: overflow"])).toBe("patch");
    expect(bumpFromCommits(["perf: cache playwright"])).toBe("patch");
    expect(bumpFromCommits(["feat!: drop portal check"])).toBe("major");
    expect(bumpFromCommits(["feat: support !:"])).toBe("minor");
    expect(bumpFromCommits(["chore: bump actions"])).toBe(null);
  });

  it("treats BREAKING CHANGE in the body as major", () => {
    expect(bumpFromCommits(["feat: rename route\n\nBREAKING CHANGE: clients must migrate"])).toBe("major");
    expect(bumpFromCommits(["fix: dates\n\nBREAKING-CHANGE: old query gone"])).toBe("major");
  });

  it("prefers major over feat over fix in a range", () => {
    expect(bumpFromCommits(["fix: a", "feat: b"])).toBe("minor");
    expect(bumpFromCommits(["feat: b", "feat!: c"])).toBe("major");
  });
});

describe("decideRelease", () => {
  it("skips when no app paths changed", () => {
    expect(
      decideRelease({ files: [".github/workflows/ci.yml"], messages: ["feat: workflows"] }),
    ).toEqual({ release: false, bump: "patch" });
  });

  it("skips chore on app paths", () => {
    expect(decideRelease({ files: ["src/app/page.tsx"], messages: ["chore: tidy"] })).toEqual({
      release: false,
      bump: "patch",
    });
  });

  it("releases on feat with app paths", () => {
    expect(decideRelease({ files: ["src/lib/a.ts"], messages: ["feat: x"] })).toEqual({
      release: true,
      bump: "minor",
    });
  });

  it("force-releases on dispatch regardless of files", () => {
    expect(
      decideRelease({
        force: true,
        forceBump: "major",
        files: ["README.md"],
        messages: ["chore: n/a"],
      }),
    ).toEqual({ release: true, bump: "major" });
  });
});

describe("nextSemver", () => {
  it("uses package.json on the first release", () => {
    expect(nextSemver(null, "minor", "0.1.0")).toEqual({ version: "0.1.0", appliedBump: "initial" });
  });

  it("bumps from the latest tag", () => {
    expect(nextSemver("v1.2.3", "patch", "0.1.0")).toEqual({ version: "1.2.4", appliedBump: "patch" });
    expect(nextSemver("v1.2.3", "minor", "0.1.0")).toEqual({ version: "1.3.0", appliedBump: "minor" });
    expect(nextSemver("v1.2.3", "major", "0.1.0")).toEqual({ version: "2.0.0", appliedBump: "major" });
  });
});

describe("azureRevisionSuffix", () => {
  it("prefixes the short SHA so retries stay unique", () => {
    expect(azureRevisionSuffix("v1.2.3", "abc1234")).toBe("abc1234-v1-2-3");
    expect(azureRevisionSuffix("v1.2.3", "abc1234", "35052231306")).toBe("abc1234-35052231306");
  });
});

describe("parseForceBump", () => {
  it("defaults unknown values to patch", () => {
    expect(parseForceBump("minor")).toBe("minor");
    expect(parseForceBump("nope")).toBe("patch");
  });
});
