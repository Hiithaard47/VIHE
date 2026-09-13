export function relativeTimeFromNow(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

// Session dates are stored at UTC midnight of the *local* calendar date —
// the app assumes one institution in one timezone (see the design doc).
// Reading local Y/M/D and rebuilding it in UTC is what keeps a session
// created at 23:30 local from landing on tomorrow's date.
export function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function sessionDateUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const utc = sessionDateUtc(date);
  return new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate() + days));
}

export function isFutureSessionDate(date: Date, now = new Date()): boolean {
  return sessionDateUtc(date).getTime() > startOfTodayUtc(now).getTime();
}

export function sessionTiming(date: Date, now = new Date()): "past" | "today" | "upcoming" {
  const day = sessionDateUtc(date).getTime();
  const today = startOfTodayUtc(now).getTime();
  if (day < today) return "past";
  if (day > today) return "upcoming";
  return "today";
}

export function isPastDueDate(dueDate: Date | null | undefined, now = new Date()): boolean {
  if (!dueDate) return false;
  return sessionDateUtc(dueDate).getTime() < startOfTodayUtc(now).getTime();
}

const DISPLAY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"] as const;

export function formatDisplayDate(date: Date): string {
  const utc = sessionDateUtc(date);
  return `${utc.getUTCDate()} ${DISPLAY_MONTHS[utc.getUTCMonth()]} ${utc.getUTCFullYear()}`;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatDayHeading(date: Date): string {
  const utc = sessionDateUtc(date);
  return `${WEEKDAYS_SHORT[utc.getUTCDay()]} ${utc.getUTCDate()}`;
}

export function formatWeekRange(monday: Date): string {
  const start = sessionDateUtc(monday);
  const end = addUtcDays(start, 6);
  const startMonth = DISPLAY_MONTHS[start.getUTCMonth()];
  const endMonth = DISPLAY_MONTHS[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startMonth === endMonth && startYear === endYear) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth} ${endYear}`;
  }
  return `${start.getUTCDate()} ${startMonth} ${startYear} – ${end.getUTCDate()} ${endMonth} ${endYear}`;
}

export function toDateInputValue(date: Date): string {
  return sessionDateUtc(date).toISOString().slice(0, 10);
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}
