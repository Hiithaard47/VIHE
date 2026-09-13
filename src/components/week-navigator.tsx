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
    <div className="flex items-center justify-end gap-2 text-sm text-ink">
      <WeekStep label="Previous week" disabled={week <= 1} onClick={onPrev}>
        &lt;
      </WeekStep>
      <p className="min-w-52 text-center text-sm text-ink">{label}</p>
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
