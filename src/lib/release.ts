import packageJson from "../../package.json";

/** Deploy sets RELEASE_TAG (e.g. v1.2.3). Local/dev falls back to package.json. */
export function getReleaseTag() {
  const fromEnv = process.env.RELEASE_TAG?.trim();
  if (fromEnv) return fromEnv;
  return `v${packageJson.version}`;
}

export function getReleaseUrl() {
  return process.env.RELEASE_URL?.trim() || null;
}
