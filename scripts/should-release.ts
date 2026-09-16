import { execFileSync } from "node:child_process";
import { decideRelease, parseForceBump, writeGithubOutput } from "../src/lib/release-gate";

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function commitMessages(range: string[]) {
  const raw = git(["log", "--format=%x1e%B", ...range]);
  return raw
    .split("\u001e")
    .map((msg) => msg.trim())
    .filter(Boolean);
}

function changedFiles(from: string | undefined, to: string) {
  if (!from || /^0+$/.test(from)) {
    return git(["show", "--pretty=", "--name-only", to])
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return git(["diff", "--name-only", from, to])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const sha = process.env.RELEASE_SHA || process.env.GITHUB_SHA;
if (!sha) {
  throw new Error("RELEASE_SHA or GITHUB_SHA is required");
}

const force = (process.env.CALLER_EVENT || process.env.GITHUB_EVENT_NAME) === "workflow_dispatch";
const decision = decideRelease({
  force,
  forceBump: parseForceBump(process.env.INPUT_BUMP),
  files: force ? [] : changedFiles(process.env.BEFORE_SHA, sha),
  messages: force ? [] : commitMessages(!process.env.BEFORE_SHA || /^0+$/.test(process.env.BEFORE_SHA) ? ["-1", sha] : [`${process.env.BEFORE_SHA}..${sha}`]),
});

writeGithubOutput({
  release: String(decision.release),
  bump: decision.bump,
});

console.log(
  decision.release
    ? `Release: ${force ? "manual dispatch" : decision.bump}`
    : "Skip: no app feat/fix/perf changes",
);
