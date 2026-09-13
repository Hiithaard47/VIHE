"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isTeacherNavActive } from "@/lib/teacher-nav";

const LINKS = [
  { href: "/teacher", label: "Courses", key: "courses" as const },
  { href: "/teacher/students", label: "Students", key: "students" as const },
];

export function TeacherNav({ showCourses, showStudents }: { showCourses: boolean; showStudents: boolean }) {
  const pathname = usePathname();
  const visible = LINKS.filter((item) => (item.key === "courses" ? showCourses : showStudents));

  return (
    <nav className="flex w-44 shrink-0 flex-col gap-1 text-sm">
      {visible.map((item) => {
        const active = isTeacherNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 ${
              active
                ? "bg-card font-semibold text-accent-dark"
                : "text-ink hover:bg-card hover:text-accent-dark"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
