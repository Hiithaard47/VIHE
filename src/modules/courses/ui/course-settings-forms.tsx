import { LoginMonthsField } from "@/components/login-months-field";
import { STATUS_OPTIONS } from "@/modules/attendance/service/policy";

export function CourseDetailsForm({
  action,
  course,
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  course: { name: string; code: string; description: string | null; loginMonths: number | null };
  disabled?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4">
      <fieldset disabled={disabled} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Course name
          <input
            name="name"
            required
            defaultValue={course.name}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Course code
          <input
            name="code"
            required
            defaultValue={course.code}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={course.description ?? ""}
            className="rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
          />
        </label>
        <LoginMonthsField value={course.loginMonths} />
        {!disabled && (
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Save details
          </button>
        )}
      </fieldset>
    </form>
  );
}

export function CoursePolicyForm({
  action,
  course,
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  course: {
    defaultStatus: string;
    lateCountsAsAttended: boolean;
    excusedCountsAsAttended: boolean;
    lockAfterDays: number | null;
  };
  disabled?: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-hairline bg-card p-4">
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Default status on a fresh session
          <select
            name="defaultStatus"
            defaultValue={course.defaultStatus}
            className="w-fit rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Every unmarked student starts here, so you only tap the exceptions.
          </span>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm text-ink">
          <legend className="text-muted">Counts as attended</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="lateCountsAsAttended" defaultChecked={course.lateCountsAsAttended} />
            Late
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="excusedCountsAsAttended" defaultChecked={course.excusedCountsAsAttended} />
            Excused
          </label>
          <span className="text-xs text-muted">Present always counts; absent never does.</span>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm text-ink">
          Lock attendance after (days)
          <input
            type="number"
            name="lockAfterDays"
            min={0}
            defaultValue={course.lockAfterDays ?? ""}
            className="w-28 rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink"
          />
          <span className="text-xs text-muted">Leave blank to never lock.</span>
        </label>

        {!disabled && (
          <button type="submit" className="w-fit rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
            Save policy
          </button>
        )}
      </fieldset>
    </form>
  );
}
