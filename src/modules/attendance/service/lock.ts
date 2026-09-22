import { addUtcDays, sessionDateUtc, startOfTodayUtc } from "@/lib/time";

export function isAttendanceLocked(
  sessionDate: Date,
  lockAfterDays: number | null | undefined,
  today: Date = startOfTodayUtc(),
) {
  if (lockAfterDays == null) return false;
  const lastOpen = addUtcDays(sessionDateUtc(sessionDate), lockAfterDays);
  return sessionDateUtc(today).getTime() > lastOpen.getTime();
}
