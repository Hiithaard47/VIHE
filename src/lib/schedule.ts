import { addUtcDays, sessionDateUtc, startOfTodayUtc } from "@/lib/time";

export type ScheduleSlot = {
  id: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  name: string;
  categoryId: string;
};

export type Meeting = {
  date: Date;
  slotId: string;
  startMinute: number;
  endMinute: number;
  name: string;
  categoryId: string;
};

export type ExistingSession = {
  id: string;
  date: Date;
  startMinute: number | null;
  slotId: string | null;
  recordCount: number;
};

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

export function generateMeetings(windowStart: Date, windowEnd: Date, slots: ScheduleSlot[]): Meeting[] {
  const start = sessionDateUtc(windowStart);
  const end = sessionDateUtc(windowEnd);
  if (end.getTime() < start.getTime()) return [];
  const meetings: Meeting[] = [];
  for (let day = start; day.getTime() <= end.getTime(); day = addUtcDays(day, 1)) {
    const weekday = day.getUTCDay();
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      meetings.push({
        date: day,
        slotId: slot.id,
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
        name: slot.name,
        categoryId: slot.categoryId,
      });
    }
  }
  return meetings;
}

function meetingKey(date: Date, startMinute: number) {
  return `${sessionDateUtc(date).toISOString()}|${startMinute}`;
}

export function isProtectedSession(session: ExistingSession, today: Date): boolean {
  if (session.recordCount > 0) return true;
  if (session.slotId == null) return true;
  return sessionDateUtc(session.date).getTime() <= sessionDateUtc(today).getTime();
}

export function diffSchedule(existing: ExistingSession[], desired: Meeting[], today: Date) {
  const desiredKeys = new Set(desired.map((item) => meetingKey(item.date, item.startMinute)));
  const existingByKey = new Map(existing.map((item) => [meetingKey(item.date, item.startMinute ?? -1), item]));

  const create = desired.filter((item) => !existingByKey.has(meetingKey(item.date, item.startMinute)));
  const remove = existing.filter((item) => {
    if (isProtectedSession(item, today)) return false;
    if (item.startMinute == null) return !desiredKeys.has(meetingKey(item.date, -1));
    return !desiredKeys.has(meetingKey(item.date, item.startMinute));
  });
  const keep = existing.filter((item) => !remove.some((row) => row.id === item.id));
  return { create, remove, keep };
}

export function applyWindow(termStart: Date, weekCount: number, today: Date, firstApply: boolean) {
  const start = mondayOf(termStart);
  const end = termEnd(termStart, weekCount);
  if (firstApply) return { start, end };
  const tomorrow = addUtcDays(sessionDateUtc(today), 1);
  return { start: start.getTime() > tomorrow.getTime() ? start : tomorrow, end };
}
