import { updateSessionDate } from "@/modules/sessions/actions";
import { formatTime } from "@/modules/schedule/service/schedule";
import { startOfTodayUtc, toDateInputValue } from "@/lib/time";
import type { CoursePortal } from "@/lib/course-workspace";

export function ChangeSessionDateForm({
  sessionId,
  date,
  startMinute,
  endMinute,
  returnTo,
  portal,
  allowPastDates = false,
}: {
  sessionId: string;
  date: Date;
  startMinute: number | null;
  endMinute: number | null;
  returnTo: string;
  portal: CoursePortal;
  allowPastDates?: boolean;
}) {
  return (
    <form
      action={updateSessionDate.bind(null, sessionId, portal)}
      aria-label="Change session date and time"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="flex flex-col gap-1 text-sm text-ink">
        Date
        <input
          type="date"
          name="date"
          required
          defaultValue={toDateInputValue(date)}
          min={allowPastDates ? undefined : toDateInputValue(startOfTodayUtc())}
          className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Start
          <input
            type="time"
            name="startTime"
            required
            defaultValue={startMinute != null ? formatTime(startMinute) : "09:00"}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          End
          <input
            type="time"
            name="endTime"
            required
            defaultValue={endMinute != null ? formatTime(endMinute) : "10:30"}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>
      <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
        Save
      </button>
    </form>
  );
}
