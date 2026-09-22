"use client";

import { useRef, type ReactNode } from "react";
import { openDialog } from "@/lib/dialog";

export function BulkImportDialog({
  title,
  action,
  hint,
  sampleCsv,
  sampleFileName,
  children,
}: {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  hint: string;
  sampleCsv: string;
  sampleFileName: string;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  function downloadSample() {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sampleFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openDialog(dialog.current)}
        className="rounded-md border border-hairline bg-card px-3 py-2 text-sm font-semibold text-ink hover:border-accent-dark"
      >
        Import CSV
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={action} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">{title}</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-hairline bg-canvas px-3 py-2">
            <p className="text-xs text-muted">{hint}</p>
            <button
              type="button"
              onClick={downloadSample}
              className="w-fit text-xs font-semibold text-accent-dark underline"
            >
              Download sample CSV
            </button>
          </div>
          {children}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">CSV file</span>
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink file:mr-3 file:rounded file:border-0 file:bg-canvas file:px-2 file:py-1 file:text-sm"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Import
          </button>
        </form>
      </dialog>
    </>
  );
}
