"use client";

import { useRef } from "react";
import { createRole } from "@/modules/roles/actions";
import { openDialog } from "@/lib/dialog";

export function AddRoleDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => openDialog(dialog.current)}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add role
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createRole} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add role</h2>
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
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Description</span>
            <input name="description" className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted" />
          </label>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create role
          </button>
        </form>
      </dialog>
    </div>
  );
}
