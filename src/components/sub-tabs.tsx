"use client";

import Link from "next/link";

export function SubTabs({
  tabs,
  hrefFor,
  isActive,
}: {
  tabs: { slug: string; label: string }[];
  hrefFor: (slug: string) => string;
  isActive: (slug: string) => boolean;
}) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const href = hrefFor(tab.slug);
        const active = isActive(tab.slug);
        return (
          <Link
            key={tab.slug || "index"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
