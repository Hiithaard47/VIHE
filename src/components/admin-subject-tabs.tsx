"use client";

import { usePathname } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "teachers", label: "Teachers" },
  { slug: "sessions", label: "Sessions" },
  { slug: "schedule", label: "Schedule" },
  { slug: "roster", label: "Roster" },
  { slug: "attendance", label: "Attendance" },
  { slug: "uploads", label: "Uploads" },
  { slug: "assignments", label: "Assignments" },
];

export function AdminSubjectTabs({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const pathname = usePathname();
  const base = `/admin/courses/${courseId}/subjects/${subjectId}`;

  return (
    <SubTabs
      tabs={TABS}
      hrefFor={(slug) => (slug ? `${base}/${slug}` : base)}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
