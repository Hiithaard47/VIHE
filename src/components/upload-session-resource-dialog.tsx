"use client";

import { useRef } from "react";
import { uploadSessionResource } from "@/app/sessions/actions";
import { UploadFileInput, UploadSubmitButton } from "@/components/upload-submit-button";
import { openDialog } from "@/lib/dialog";
import type { CoursePortal } from "@/lib/course-workspace";

export function UploadSessionResourceDialog({
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
        Upload file
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={uploadSessionResource.bind(null, sessionId, portal)} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Upload file</h2>
            <button type="button" onClick={() => dialog.current?.close()} className="text-sm text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted">PDF or image for this session. Students see it under Documents.</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">File</span>
            <UploadFileInput
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            />
          </label>
          <UploadSubmitButton idleLabel="Upload" />
        </form>
      </dialog>
    </>
  );
}
