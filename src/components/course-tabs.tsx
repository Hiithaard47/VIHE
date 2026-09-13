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

export function CourseTabs({ courseId, canConfigure }: { courseId: string; canConfigure: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const batch = searchParams.get("batch");
  const query = batch ? `?batch=${batch}` : "";
  const base = `/teacher/courses/${courseId}`;
  const tabs = canConfigure ? TABS : TABS.filter((tab) => tab.slug !== "schedule" && tab.slug !== "settings");

  return (
    <SubTabs
      tabs={tabs}
      hrefFor={(slug) => `${slug ? `${base}/${slug}` : base}${query}`}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
