"use client";

import { useRef } from "react";
import { assignSessionHomework } from "@/app/sessions/homework-actions";
import { openDialog } from "@/lib/dialog";
import type { CoursePortal } from "@/lib/course-workspace";

export function AssignSessionHomeworkDialog({
  sessionId,
  portal,
}: {
  sessionId: string;
  portal: CoursePortal;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => openDialog(dialog.current)}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Assign homework
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={assignSessionHomework.bind(null, sessionId, portal)} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Assign homework</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted">
            Students can upload only on the session day. Homework is not graded.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Title</span>
            <input
              name="title"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Instructions (optional)</span>
            <textarea
              name="instructions"
              rows={3}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Assign homework
          </button>
        </form>
      </dialog>
    </>
  );
}
