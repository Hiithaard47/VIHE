"use client";

import { useEffect, useRef, useState } from "react";
import { openDialog } from "@/lib/dialog";
import { formatDisplayDate, toDateInputValue } from "@/lib/time";

export function AddWeekSessionDialog({
  open,
  date,
  title,
  submitLabel,
  defaultCategoryId,
  categories,
  error,
  onLocalSubmit,
  onClose,
}: {
  open: boolean;
  date: Date | null;
  title: string;
  submitLabel: string;
  defaultCategoryId: string;
  categories: { id: string; name: string }[];
  error?: string | null;
  onLocalSubmit: (formData: FormData) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open) openDialog(node);
    else if (node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="add-week-session-title"
      onClose={onClose}
      className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const ok = await onLocalSubmit(new FormData(event.currentTarget));
            if (ok) onClose();
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-4 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="add-week-session-title" className="font-heading text-base font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Cancel
          </button>
        </div>
        {date && (
          <>
            <p className="text-sm text-muted">{formatDisplayDate(date)}</p>
            <input type="hidden" name="date" value={toDateInputValue(date)} />
          </>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink">
          Name
          <input
            name="name"
            required
            autoFocus
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Category
          <select
            name="categoryId"
            required
            defaultValue={defaultCategoryId}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            Start
            <input
              type="time"
              name="startTime"
              required
              defaultValue="09:00"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            End
            <input
              type="time"
              name="endTime"
              required
              defaultValue="10:30"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>
    </dialog>
  );
}
