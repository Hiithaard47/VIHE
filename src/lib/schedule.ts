import { addUtcDays, sessionDateUtc, startOfTodayUtc } from "@/lib/time";

export function mondayOf(date: Date): Date {
  const day = sessionDateUtc(date);
  const weekday = day.getUTCDay();
  return addUtcDays(day, weekday === 0 ? -6 : 1 - weekday);
}

export function termEnd(termStart: Date, weekCount: number): Date {
  return addUtcDays(mondayOf(termStart), weekCount * 7 - 1);
}

export function weekStart(termStart: Date, weekNumber: number): Date {
  return addUtcDays(mondayOf(termStart), (weekNumber - 1) * 7);
}

export function clampWeek(weekNumber: number, weekCount: number): number {
  if (weekCount < 1) return 1;
  return Math.min(Math.max(1, weekNumber), weekCount);
}

export function daysOfWeek(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addUtcDays(monday, i));
}

export function weekNumberOf(termStart: Date, date: Date): number {
  const start = mondayOf(termStart).getTime();
  const day = mondayOf(date).getTime();
  return Math.floor((day - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function inferTerm(dates: Date[], today: Date = startOfTodayUtc()): { termStart: Date; weekCount: number } {
  if (dates.length === 0) return { termStart: mondayOf(today), weekCount: 1 };
  let first = dates[0];
  let last = dates[0];
  for (const date of dates) {
    if (date.getTime() < first.getTime()) first = date;
    if (date.getTime() > last.getTime()) last = date;
  }
  const termStart = mondayOf(first);
  return { termStart, weekCount: Math.max(1, weekNumberOf(termStart, last)) };
}

export function nextFreeWeekday(
  taken: { weekday: number; startMinute: number }[],
  fromWeekday: number,
  startMinute: number,
): number | null {
  for (let step = 1; step <= 6; step++) {
    const weekday = (fromWeekday + step) % 7;
    if (!taken.some((item) => item.weekday === weekday && item.startMinute === startMinute)) return weekday;
  }
  return null;
}

export function parseMeetingTimes(startTime: string, endTime: string): { startMinute: number; endMinute: number } | null {
  const startMinute = parseTimeInput(startTime);
  const endMinute = parseTimeInput(endTime);
  if (startMinute == null || endMinute == null || endMinute <= startMinute) return null;
  return { startMinute, endMinute };
}

export function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatTime(minute: number): string {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

