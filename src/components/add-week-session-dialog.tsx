"use client";

import { useEffect, useRef } from "react";
import { formatDisplayDate, toDateInputValue } from "@/lib/time";

export function AddWeekSessionDialog({
  open,
  date,
  title,
  submitLabel,
  defaultCategoryId,
  categories,
  onLocalSubmit,
  onClose,
}: {
  open: boolean;
  date: Date | null;
  title: string;
  submitLabel: string;
  defaultCategoryId: string;
  categories: { id: string; name: string }[];
  onLocalSubmit: (formData: FormData) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open) node.showModal();
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
        onSubmit={(event) => {
          event.preventDefault();
          onLocalSubmit(new FormData(event.currentTarget));
          onClose();
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
        <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
          {submitLabel}
        </button>
      </form>
    </dialog>
  );
}
