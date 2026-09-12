"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "teachers", label: "Teachers" },
  { slug: "roster", label: "Roster" },
];

export function AdminBatchTabs({ courseId, batchId }: { courseId: string; batchId: string }) {
  const pathname = usePathname();
  const base = `/admin/courses/${courseId}/batches/${batchId}`;

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.slug || "overview"}
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
