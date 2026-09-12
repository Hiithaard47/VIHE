import { updateSessionDate } from "@/app/teacher/sessions/[sessionId]/actions";
import { startOfTodayUtc, toDateInputValue } from "@/lib/time";
import type { CoursePortal } from "@/lib/course-workspace";

export function ChangeSessionDateForm({
  sessionId,
  date,
  returnTo,
  portal,
}: {
  sessionId: string;
  date: Date;
  returnTo: string;
  portal: CoursePortal;
}) {
  return (
    <form
      action={updateSessionDate.bind(null, sessionId, portal)}
      aria-label="Change session date"
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="flex flex-col gap-1 text-sm text-ink">
        Date
        <input
          type="date"
          name="date"
          required
          defaultValue={toDateInputValue(date)}
          min={toDateInputValue(startOfTodayUtc())}
          className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
        />
      </label>
      <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-accent">
        Save date
      </button>
    </form>
  );
}
