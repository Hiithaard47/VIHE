import { describe, expect, it } from "vitest";
import {
  clampWeek,
  daysOfWeek,
  formatTime,
  inferTerm,
  mondayOf,
  nextFreeWeekday,
  parseMeetingTimes,
  parseTimeInput,
  termEnd,
  weekNumberOf,
  weekStart,
} from "@/modules/schedule/service/schedule";

describe("week helpers", () => {
  it("snaps to Monday and builds a seven-day week", () => {
    const wednesday = new Date("2026-09-02T00:00:00.000Z");
    expect(mondayOf(wednesday).toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(termEnd(wednesday, 2).toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(weekStart(wednesday, 2).toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(daysOfWeek(mondayOf(wednesday)).map((d) => d.getUTCDate())).toEqual([31, 1, 2, 3, 4, 5, 6]);
    expect(clampWeek(0, 16)).toBe(1);
    expect(clampWeek(20, 16)).toBe(16);
    expect(weekNumberOf(wednesday, new Date("2026-09-08T00:00:00.000Z"))).toBe(2);
    expect(inferTerm([new Date("2026-09-01T00:00:00.000Z"), new Date("2026-09-08T00:00:00.000Z")])).toEqual({
      termStart: new Date("2026-08-31T00:00:00.000Z"),
      weekCount: 2,
    });
    expect(nextFreeWeekday([{ weekday: 1, startMinute: 540 }], 1, 540)).toBe(2);
    expect(nextFreeWeekday([1, 2, 3, 4, 5, 6, 0].map((weekday) => ({ weekday, startMinute: 540 })), 1, 540)).toBeNull();
  });
});

describe("time helpers", () => {
  it("parses and formats wall-clock minutes", () => {
    expect(parseTimeInput("09:00")).toBe(540);
    expect(parseTimeInput("25:00")).toBeNull();
    expect(formatTime(545)).toBe("09:05");
    expect(parseMeetingTimes("09:00", "10:30")).toEqual({ startMinute: 540, endMinute: 630 });
    expect(parseMeetingTimes("10:30", "09:00")).toBeNull();
  });
});
