import { formatWeekRange } from "@/lib/time";

export function WeekNavigator({
  week,
  weekCount,
  monday,
  onPrev,
  onNext,
}: {
  week: number;
  weekCount: number;
  monday: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  const label = `Week ${week} of ${weekCount}  ·  ${formatWeekRange(monday)}`;

  return (
    <div className="flex w-full items-center justify-between gap-2 text-sm text-ink sm:w-auto sm:justify-end">
      <WeekStep label="Previous week" disabled={week <= 1} onClick={onPrev}>
        &lt;
      </WeekStep>
      <p className="min-w-0 flex-1 text-center text-xs leading-snug text-ink sm:min-w-52 sm:flex-none sm:text-sm">
        {label}
      </p>
      <WeekStep label="Next week" disabled={week >= weekCount} onClick={onNext}>
        &gt;
      </WeekStep>
    </div>
  );
}

function WeekStep({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-sm ${disabled ? "text-muted" : "text-ink hover:bg-canvas"}`}
    >
      {children}
    </button>
  );
}
