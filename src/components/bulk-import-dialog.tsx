"use client";

import { useRef, type ReactNode } from "react";

export function BulkImportDialog({
  title,
  action,
  hint,
  children,
}: {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  hint: string;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
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
          <p className="text-xs text-muted">{hint}</p>
          {children}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">CSV file</span>
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              autoFocus
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
