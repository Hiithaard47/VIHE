"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const BASE_TABS = [
  { slug: "", label: "Sessions" },
  { slug: "roster", label: "Roster" },
  { slug: "attendance", label: "Attendance" },
  { slug: "uploads", label: "Uploads" },
  { slug: "assignments", label: "Assignments" },
];
const CONFIG_TABS = [{ slug: "settings", label: "Settings" }];

const SCHEDULE_TAB = { slug: "schedule", label: "Schedule" };

export function CourseTabs({ courseId, canConfigure }: { courseId: string; canConfigure: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const batch = searchParams.get("batch");
  const query = batch ? `?batch=${batch}` : "";
  const base = `/teacher/courses/${courseId}`;
  const tabs = canConfigure
    ? [BASE_TABS[0], SCHEDULE_TAB, ...BASE_TABS.slice(1), ...CONFIG_TABS]
    : BASE_TABS;

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const href = `${tab.slug ? `${base}/${tab.slug}` : base}${query}`;
        const path = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(path) : pathname === base;
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
