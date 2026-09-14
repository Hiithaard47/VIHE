"use client";

import { usePathname } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

const TABS = [
  { slug: "", label: "Subjects" },
  { slug: "roster", label: "Roster" },
  { slug: "details", label: "Details" },
  { slug: "policy", label: "Policy" },
];

export function AdminCourseTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/admin/courses/${courseId}`;

  return (
    <SubTabs
      tabs={TABS}
      hrefFor={(slug) => (slug ? `${base}/${slug}` : base)}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
