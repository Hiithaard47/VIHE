"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChangeSessionDateForm } from "@/components/change-session-date-form";
import { deleteSession } from "@/app/sessions/actions";
import type { CoursePortal } from "@/lib/course-workspace";

export function SessionActionsMenu({
  sessionId,
  date,
  startMinute,
  endMinute,
  returnTo,
  attendanceHref,
  canChangeDate,
  canRemove = false,
  deleteReturnTo,
  portal,
}: {
  sessionId: string;
  date: string;
  startMinute: number | null;
  endMinute: number | null;
  returnTo: string;
  attendanceHref?: string;
  canChangeDate: boolean;
  canRemove?: boolean;
  deleteReturnTo?: string;
  portal: CoursePortal;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `change-session-date-title-${sessionId}`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openChangeDate() {
    setOpen(false);
    dialog.current?.showModal();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Session actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
          <circle cx="10" cy="4" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="16" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Session actions"
          className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-md border border-hairline bg-card py-1 shadow-lg"
        >
          {attendanceHref && (
            <Link
              role="menuitem"
              href={attendanceHref}
              className="block px-3 py-2 text-sm text-ink hover:bg-canvas"
              onClick={() => setOpen(false)}
            >
              Mark attendance
            </Link>
          )}
          {canChangeDate && (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              onClick={openChangeDate}
            >
              Change date or time
            </button>
          )}
          {canRemove && (
            <form action={deleteSession.bind(null, sessionId, portal)}>
              <input type="hidden" name="returnTo" value={deleteReturnTo ?? returnTo} />
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              >
                Remove
              </button>
            </form>
          )}
        </div>
      )}
      {canChangeDate && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
        >
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="font-heading text-base font-semibold">
                Change date or time
              </h2>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
            <ChangeSessionDateForm
              sessionId={sessionId}
              date={new Date(date)}
              startMinute={startMinute}
              endMinute={endMinute}
              returnTo={returnTo}
              portal={portal}
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
