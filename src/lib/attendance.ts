export const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
] as const;

export type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

export type AttendancePolicy = {
  minAttendancePercent: number | null;
  lateCountsAsAttended: boolean;
  excusedCountsAsAttended: boolean;
};

export type StatusTally = Record<StatusValue, number>;

export function emptyTally(): StatusTally {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
}

// PRESENT and ABSENT are fixed points: a policy that could exclude PRESENT
// or include ABSENT would only describe states that make no sense.
export function countsAsAttended(status: StatusValue, policy: AttendancePolicy): boolean {
  switch (status) {
    case "PRESENT":
      return true;
    case "ABSENT":
      return false;
    case "LATE":
      return policy.lateCountsAsAttended;
    case "EXCUSED":
      return policy.excusedCountsAsAttended;
  }
}

// Denominator is the student's own marked sessions, so a student who
// enrolled mid-term isn't penalised for classes held before they joined.
// Returns null rather than 0 when nothing is marked — "no data" and "never
// showed up" must not render the same.
export function attendancePercent(tally: StatusTally, policy: AttendancePolicy): number | null {
  let total = 0;
  let attended = 0;

  for (const { value } of STATUS_OPTIONS) {
    total += tally[value];
    if (countsAsAttended(value, policy)) attended += tally[value];
  }

  if (total === 0) return null;
  return Math.round((attended / total) * 100);
}

export function isAtRisk(percent: number | null, policy: AttendancePolicy): boolean {
  if (percent === null || policy.minAttendancePercent === null) return false;
  return percent < policy.minAttendancePercent;
}
