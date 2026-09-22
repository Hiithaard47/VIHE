"use client";

import { useRef } from "react";
import { createUser } from "@/modules/teachers/actions";
import { openDialog } from "@/lib/dialog";

export function AddTeacherDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => openDialog(dialog.current)}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add teacher
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createUser} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add teacher</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Full name</span>
            <input
              name="name"
              required
              autoFocus
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Email</span>
            <input
              name="email"
              type="email"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Mobile (optional)</span>
            <input
              name="phone"
              type="tel"
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Temporary password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 text-muted">Roles</legend>
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="roleIds" value={role.id} />
                {role.name}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create teacher
          </button>
        </form>
      </dialog>
    </>
  );
}
