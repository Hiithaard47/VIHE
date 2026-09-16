"use client";

import { useRef } from "react";
import { createStudent } from "@/app/admin/students/actions";

export function AddStudentDialog({
  courses,
  enrolledCourseIds = [],
}: {
  courses: { id: string; name: string }[];
  enrolledCourseIds?: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const enrolled = new Set(enrolledCourseIds);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
      >
        Add student
      </button>
      <dialog
        ref={dialog}
        className="fixed left-1/2 top-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-0 text-ink shadow-lg backdrop:bg-ink/40"
      >
        <form action={createStudent} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-base font-semibold">Add student</h2>
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
            <span className="text-muted">Roll number</span>
            <input
              name="rollNumber"
              required
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Email (optional)</span>
            <input
              name="email"
              type="email"
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
            <span className="text-muted">Portal password (optional)</span>
            <input
              name="password"
              type="password"
              minLength={8}
              className="rounded-md border border-hairline bg-input px-3 py-2 text-ink placeholder:text-muted"
            />
          </label>
          {courses.length > 0 && (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 text-muted">Enroll in courses</legend>
              {courses.map((course) => (
                <label key={course.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`course-${course.id}`}
                    defaultChecked={enrolled.has(course.id)}
                    className="rounded border-hairline"
                  />
                  <span>{course.name}</span>
                </label>
              ))}
            </fieldset>
          )}
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Create student
          </button>
        </form>
      </dialog>
    </>
  );
}
