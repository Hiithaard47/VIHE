import { execFileSync } from "node:child_process";
import packageJson from "../package.json";
import { azureRevisionSuffix, nextSemver, parseForceBump, writeGithubOutput } from "../src/lib/release-gate";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const bump = parseForceBump(arg("bump") || process.env.RELEASE_BUMP);
const sha = arg("sha") || process.env.RELEASE_SHA || process.env.GITHUB_SHA;
const login = arg("login-server") || process.env.ACR_LOGIN_SERVER;
const app = arg("app") || process.env.AZURE_APP_NAME || "vihe-app";
if (!sha) throw new Error("--sha or GITHUB_SHA is required");
if (!login) throw new Error("--login-server is required");

execFileSync("git", ["fetch", "--tags", "--force"], { stdio: "inherit" });
const latest =
  git(["tag", "--sort=-v:refname", "-l", "v[0-9]*.[0-9]*.[0-9]*"])
    .split("\n")
    .find(Boolean) || null;
const { version, appliedBump } = nextSemver(latest, latest ? bump : "initial", packageJson.version);
const releaseTag = `v${version}`;
const shortSha = sha.slice(0, 7);
const existingTag = git(["tag", "-l", releaseTag]);
if (existingTag) {
  const pointed = git(["rev-parse", `${releaseTag}^{commit}`]);
  if (pointed !== sha && !pointed.startsWith(sha) && !sha.startsWith(pointed)) {
    throw new Error(`Tag ${releaseTag} already exists at ${pointed}`);
  }
}

writeGithubOutput({
  version,
  short_sha: shortSha,
  release_tag: releaseTag,
  revision_suffix: azureRevisionSuffix(releaseTag, shortSha, process.env.GITHUB_RUN_ID),
  bump: appliedBump,
  image_uri: `${login}/${app}:${releaseTag}`,
  image_uri_sha: `${login}/${app}:sha-${shortSha}`,
  image_uri_latest: `${login}/${app}:latest`,
});

console.log(`Next release: ${releaseTag} (from ${latest ?? `package.json ${packageJson.version}`}, bump=${appliedBump})`);
