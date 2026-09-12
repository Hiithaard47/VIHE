"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { slug: "", label: "Sessions" },
  { slug: "roster", label: "Roster" },
  { slug: "attendance", label: "Attendance" },
  { slug: "uploads", label: "Uploads" },
];
const CONFIG_TABS = [{ slug: "settings", label: "Settings" }];

export function CourseTabs({ courseId, canConfigure }: { courseId: string; canConfigure: boolean }) {
  const pathname = usePathname();
  const base = `/teacher/courses/${courseId}`;
  const tabs = canConfigure ? [...BASE_TABS, ...CONFIG_TABS] : BASE_TABS;

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.slug || "sessions"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-ink font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
