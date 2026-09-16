"use client";

import { useRef } from "react";
import { createCourse } from "@/app/admin/courses/actions";

export function AddCourseDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add course
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createCourse} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add course</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="text-sm text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Course name</span>
            <input
              name="name"
              placeholder="Bhakti Sastra"
              required
              autoFocus
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Course code</span>
            <input
              name="code"
              placeholder="BS"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Description (optional)</span>
            <textarea
              name="description"
              rows={3}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create course
          </button>
        </form>
      </dialog>
    </>
  );
}
