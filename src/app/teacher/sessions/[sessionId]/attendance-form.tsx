"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_OPTIONS, type StatusValue } from "@/lib/attendance";

type StudentRow = {
  id: string;
  rollNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: StatusValue;
};

const AUTOSAVE_DELAY_MS = 1200;

export function AttendanceForm({
  action,
  students,
}: {
  action: (formData: FormData) => void | Promise<void>;
  students: StudentRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [statuses, setStatuses] = useState<Record<string, StatusValue>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status])),
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Tracks the last `statuses` value the effect below has already reacted
  // to. Compared by reference, not a boolean "first render" flag: dev-mode
  // Strict Mode replays this effect a second time against the *same*
  // `statuses` object with no real state change in between, and a boolean
  // guard flips permanently on the first replay — silently re-arming
  // autosave on every mount. Reference equality survives the replay.
  const lastHandled = useRef(statuses);

  // Autosave: any status change quietly submits the whole roster a moment
  // later, so a teacher marking a full class never has to remember to hit
  // Save. The manual button stays as a fallback / immediate confirm.
  useEffect(() => {
    if (statuses === lastHandled.current) return;
    lastHandled.current = statuses;

    setSaving(true);
    const timeout = setTimeout(() => formRef.current?.requestSubmit(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [statuses]);

  const counts = useMemo(() => {
    const tally: Record<StatusValue, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const status of Object.values(statuses)) tally[status]++;
    return tally;
  }, [statuses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.name, s.rollNumber, s.email ?? "", s.phone ?? ""].some((value) => value.toLowerCase().includes(q)),
    );
  }, [students, query]);
  const visibleIds = useMemo(() => new Set(filtered.map((s) => s.id)), [filtered]);

  function markAll(status: StatusValue) {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const s of students) next[s.id] = status;
      return next;
    });
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Search by name, roll no., email, or mobile"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() => markAll("PRESENT")}
          className="rounded-md border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-canvas"
        >
          Mark all present
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-canvas text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Roll no.</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr
                key={student.id}
                className={`border-b border-hairline text-ink last:border-0 ${visibleIds.has(student.id) ? "" : "hidden"}`}
              >
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">{student.name}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="inline-flex cursor-pointer items-center rounded-full border border-hairline px-3 py-1.5 text-xs text-muted has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:font-medium"
                      >
                        <input
                          type="radio"
                          name={`status:${student.id}`}
                          value={opt.value}
                          checked={statuses[student.id] === opt.value}
                          onChange={() => setStatuses((prev) => ({ ...prev, [student.id]: opt.value }))}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No students enrolled in this course yet.
                </td>
              </tr>
            )}
            {students.length > 0 && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-muted">
                  No students match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3 shadow-[0_4px_16px_rgba(32,36,46,0.08)]">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-medium text-ink">{counts.PRESENT} present</span>
          <span>{counts.ABSENT} absent</span>
          <span>{counts.LATE} late</span>
          <span>{counts.EXCUSED} excused</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{saving ? "Saving…" : "Autosaves as you go"}</span>
          <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Save attendance
          </button>
        </div>
      </div>
    </form>
  );
}
