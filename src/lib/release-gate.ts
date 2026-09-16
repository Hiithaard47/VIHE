import { appendFileSync } from "node:fs";

export type ReleaseBump = "major" | "minor" | "patch";

const APP_PATHS = [
  /^src\//,
  /^prisma\//,
  /^public\//,
  /^scripts\/start-prod\.sh$/,
  /^package(-lock)?\.json$/,
  /^Dockerfile(\.|$)/,
  /^next\.config\./,
];

export function isAppChangePath(file: string) {
  const path = file.trim();
  if (!path) return false;
  return APP_PATHS.some((pattern) => pattern.test(path));
}

export function bumpFromCommits(messages: readonly string[]): ReleaseBump | null {
  let hasFix = false;
  let hasFeat = false;
  let hasBreaking = false;

  for (const raw of messages) {
    const msg = raw.trim();
    if (!msg) continue;
    const newline = msg.indexOf("\n");
    const subject = (newline === -1 ? msg : msg.slice(0, newline)).trim();
    const body = newline === -1 ? "" : msg.slice(newline + 1);

    if (/^(feat|fix|perf)(\([^)]+\))?!:/.test(subject)) hasBreaking = true;
    if (/^BREAKING[- ]CHANGE:/m.test(body)) hasBreaking = true;

    if (/^feat(\([^)]+\))?(!)?:/.test(subject)) hasFeat = true;
    else if (/^(fix|perf)(\([^)]+\))?(!)?:/.test(subject)) hasFix = true;
  }

  if (hasBreaking) return "major";
  if (hasFeat) return "minor";
  if (hasFix) return "patch";
  return null;
}

export function decideRelease({
  force = false,
  forceBump = "patch",
  files,
  messages,
}: {
  force?: boolean;
  forceBump?: ReleaseBump;
  files: readonly string[];
  messages: readonly string[];
}): { release: boolean; bump: ReleaseBump } {
  if (force) return { release: true, bump: forceBump };
  if (!files.some(isAppChangePath)) return { release: false, bump: "patch" };
  const bump = bumpFromCommits(messages);
  if (!bump) return { release: false, bump: "patch" };
  return { release: true, bump };
}

export function nextSemver(
  latestTag: string | null,
  bump: ReleaseBump | "initial" | string,
  packageVersion: string,
): { version: string; appliedBump: string } {
  const pkg = packageVersion.replace(/^v/, "");
  if (!latestTag) return { version: pkg, appliedBump: "initial" };

  const base = latestTag.replace(/^v/, "");
  const parts = base.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`Unparseable SemVer tag ${latestTag}`);
  }
  let [major, minor, patch] = parts;
  switch (bump) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Unknown bump '${bump}' (expected patch|minor|major)`);
  }
  return { version: `${major}.${minor}.${patch}`, appliedBump: bump };
}

export function azureRevisionSuffix(releaseTag: string, shortSha: string, uniqueness = "") {
  const version = releaseTag.toLowerCase().replace(/\./g, "-");
  const token = uniqueness ? `${shortSha}-${uniqueness}` : `${shortSha}-${version}`;
  return token.slice(0, 20);
}

export function parseForceBump(value: string | undefined): ReleaseBump {
  if (value === "major" || value === "minor" || value === "patch") return value;
  return "patch";
}

export function writeGithubOutput(lines: Record<string, string>, outPath = process.env.GITHUB_OUTPUT) {
  const body = Object.entries(lines)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  if (outPath) {
    appendFileSync(outPath, `${body}\n`);
    return;
  }
  console.log(body);
}
