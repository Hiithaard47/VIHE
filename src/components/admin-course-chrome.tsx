"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminCourseTabs } from "@/components/admin-course-tabs";

export function AdminCourseChrome({
  courseId,
  name,
  code,
  isActive,
  action,
  children,
}: {
  courseId: string;
  name: string;
  code: string;
  isActive: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname.includes("/batches/")) return children;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
            &larr; Courses
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-semibold text-ink">{name}</h1>
            {!isActive && <span className="text-xs text-muted">Archived</span>}
          </div>
          <p className="text-sm text-muted">{code}</p>
          {!isActive && (
            <p className="mt-2 text-sm text-muted">This course is archived. Restore it to make changes.</p>
          )}
        </div>
        {action}
      </div>
      <AdminCourseTabs courseId={courseId} />
      {children}
    </>
  );
}
