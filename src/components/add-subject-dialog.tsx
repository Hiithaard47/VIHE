"use client";

import { useRef } from "react";
import { createSubject } from "@/app/admin/courses/[courseId]/actions";

export function AddSubjectDialog({ courseId }: { courseId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add subject
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createSubject.bind(null, courseId)} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add subject</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="text-sm text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Subject name</span>
            <input
              name="name"
              placeholder="Morning"
              required
              autoFocus
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create subject
          </button>
        </form>
      </dialog>
    </>
  );
}
