"use client";

import { useSearchParams } from "next/navigation";

export function TeacherCourseHeading({
  name,
  code,
  subjects,
  enrolledCount,
}: {
  name: string;
  code: string;
  subjects: { id: string; name: string }[];
  enrolledCount: number;
}) {
  const selectedId = useSearchParams().get("subject");
  const selectedSubject = subjects.find((item) => item.id === selectedId);

  return (
    <>
      <h1 className="font-heading text-lg font-semibold break-words text-ink print:hidden">{name}</h1>
      <p className="text-sm text-muted">
        {code}
        {selectedSubject ? ` · ${selectedSubject.name}` : ""}
        {` · ${enrolledCount} enrolled student(s)`}
      </p>
    </>
  );
}
