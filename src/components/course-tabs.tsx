"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

const TABS = [
  { slug: "", label: "Sessions" },
  { slug: "schedule", label: "Schedule" },
  { slug: "roster", label: "Roster" },
  { slug: "attendance", label: "Attendance" },
  { slug: "uploads", label: "Uploads" },
  { slug: "assignments", label: "Assignments" },
  { slug: "settings", label: "Settings" },
];

export function CourseTabs({
  courseId,
  slugs,
}: {
  courseId: string;
  slugs: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subject = searchParams.get("subject");
  const query = subject ? `?subject=${subject}` : "";
  const base = `/teacher/courses/${courseId}`;
  const tabs = TABS.filter((tab) => slugs.includes(tab.slug));

  return (
    <SubTabs
      tabs={tabs}
      hrefFor={(slug) => `${slug ? `${base}/${slug}` : base}${query}`}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
