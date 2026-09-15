import { getReleaseTag, getReleaseUrl } from "@/lib/release";

/** Release tag for support/debug. Kept in the DOM but always visually hidden. */
export function AppFooter() {
  const tag = getReleaseTag();
  const url = getReleaseUrl();

  return (
    <footer className="hidden" aria-hidden="true" data-release-tag={tag} data-release-url={url ?? undefined}>
      {tag}
    </footer>
  );
}
