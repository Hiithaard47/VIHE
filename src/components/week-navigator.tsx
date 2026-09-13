import Link from "next/link";
import { formatWeekRange } from "@/lib/time";

export function WeekNavigator({
  week,
  weekCount,
  monday,
  prevHref,
  nextHref,
  onPrev,
  onNext,
}: {
  week: number;
  weekCount: number;
  monday: Date;
  prevHref?: string;
  nextHref?: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const label = `Week ${week} of ${weekCount}  ·  ${formatWeekRange(monday)}`;
  const canPrev = week > 1;
  const canNext = week < weekCount;

  return (
    <div className="flex items-center justify-end gap-2 text-sm text-ink">
      <WeekStep
        label="Previous week"
        disabled={!canPrev}
        href={canPrev ? prevHref : undefined}
        onClick={canPrev ? onPrev : undefined}
      >
        &lt;
      </WeekStep>
      <p className="min-w-52 text-center text-sm text-ink">{label}</p>
      <WeekStep
        label="Next week"
        disabled={!canNext}
        href={canNext ? nextHref : undefined}
        onClick={canNext ? onNext : undefined}
      >
        &gt;
      </WeekStep>
    </div>
  );
}

function WeekStep({
  label,
  disabled,
  href,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = `rounded-md px-2 py-1 text-sm ${
    disabled ? "text-muted" : "text-ink hover:bg-canvas"
  }`;
  if (href && !disabled) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
