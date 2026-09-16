"use client";

import { useRef } from "react";
import { createSessionCategory } from "@/app/admin/session-categories/actions";

export function AddSessionCategoryDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add category
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createSessionCategory} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add session category</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              name="name"
              required
              autoFocus
              placeholder="Mangala Aarti"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Minimum attendance % (optional)</span>
            <input
              name="minAttendancePercent"
              type="number"
              min={0}
              max={100}
              className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-ink"
            />
            <span className="text-xs text-muted">Leave blank for no at-risk flag.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="allowsResources" defaultChecked className="mt-1" />
            <span>
              Allow session files
              <span className="block text-xs text-muted">
                Show upload and file list on sessions of this category.
              </span>
            </span>
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create category
          </button>
        </form>
      </dialog>
    </>
  );
}
