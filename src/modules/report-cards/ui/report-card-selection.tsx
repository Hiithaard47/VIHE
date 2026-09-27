"use client";

import { useState } from "react";

type Student = { id: string; name: string; rollNumber: string };

export function ReportCardSelection({
  students,
  courseId,
}: {
  students: Student[];
  courseId: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedIds(newSet);

    // Update data attribute immediately
    const element = document.querySelector("[data-selected-students]");
    if (element) {
      element.setAttribute(
        "data-selected-students",
        JSON.stringify(Array.from(newSet)),
      );
    }
  };

  const toggleAll = () => {
    let newSet: Set<string>;
    if (selectedIds.size === students.length) {
      newSet = new Set();
    } else {
      newSet = new Set(students.map((s) => s.id));
    }
    setSelectedIds(newSet);

    // Update data attribute immediately
    const element = document.querySelector("[data-selected-students]");
    if (element) {
      element.setAttribute(
        "data-selected-students",
        JSON.stringify(Array.from(newSet)),
      );
    }
  };

  const isAllSelected = selectedIds.size === students.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="print:hidden">
      {/* Selection controls */}
      <div className="mb-4 rounded-lg border border-hairline bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold">Print Report Cards</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="text-xs font-medium text-accent-dark underline hover:text-accent"
            >
              {isAllSelected ? "Deselect all" : "Select all"}
            </button>
            <PrintReportButton selectedCount={selectedIds.size} />
          </div>
        </div>

        {/* Student checkboxes */}
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {students.map((student) => (
            <label
              key={student.id}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-canvas p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(student.id)}
                onChange={() => toggleStudent(student.id)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="font-medium">{student.name}</span>
              <span className="text-xs text-muted">({student.rollNumber})</span>
            </label>
          ))}
        </div>

        {students.length === 0 && (
          <p className="text-sm text-muted">No students enrolled.</p>
        )}
      </div>

      {/* Hidden data attribute to pass selected IDs */}
      <div data-selected-students="[]" />
    </div>
  );
}

function PrintReportButton({ selectedCount }: { selectedCount: number }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={selectedCount === 0}
      className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
    >
      {selectedCount > 0 ? `Print (${selectedCount})` : "Print report cards"}
    </button>
  );
}