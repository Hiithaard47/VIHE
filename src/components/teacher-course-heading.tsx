"use client";

import { useSearchParams } from "next/navigation";

export function TeacherCourseHeading({
  name,
  code,
  batches,
}: {
  name: string;
  code: string;
  batches: { id: string; name: string; enrolled: number }[];
}) {
  const selectedId = useSearchParams().get("batch");
  const batch = batches.find((item) => item.id === selectedId);
  const enrolled = batch ? batch.enrolled : batches.reduce((total, item) => total + item.enrolled, 0);

  return (
    <>
      <h1 className="font-heading text-lg font-semibold text-ink">{name}</h1>
      <p className="text-sm text-muted">
        {code}
        {batch ? ` · ${batch.name}` : ""}
        {` · ${enrolled} enrolled student(s)`}
      </p>
    </>
  );
}
