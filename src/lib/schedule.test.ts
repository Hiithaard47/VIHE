import { describe, expect, it } from "vitest";
import {
  applyWindow,
  clampWeek,
  daysOfWeek,
  diffSchedule,
  formatTime,
  generateMeetings,
  inferTerm,
  isProtectedSession,
  mondayOf,
  nextFreeWeekday,
  parseMeetingTimes,
  parseTimeInput,
  termEnd,
  weekNumberOf,
  weekStart,
} from "@/lib/schedule";

const slot = {
  id: "slot-class",
  weekday: 2,
  startMinute: 540,
  endMinute: 630,
  name: "Chapter 1",
  categoryId: "cat-class",
};

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

describe("generateMeetings", () => {
  it("emits one meeting per matching weekday in the window", () => {
    const meetings = generateMeetings(
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-13T00:00:00.000Z"),
      [slot],
    );
    expect(meetings.map((item) => item.date.toISOString())).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-09-08T00:00:00.000Z",
    ]);
    expect(meetings[0].name).toBe("Chapter 1");
  });
});

describe("diffSchedule", () => {
  const desired = generateMeetings(
    new Date("2026-08-31T00:00:00.000Z"),
    new Date("2026-09-13T00:00:00.000Z"),
    [slot],
  );
  const today = new Date("2026-09-01T00:00:00.000Z");

  it("creates missing meetings and skips protected sessions", () => {
    const existing = [
      {
        id: "marked",
        date: new Date("2026-09-01T00:00:00.000Z"),
        startMinute: 540,
        slotId: "old",
        recordCount: 1,
      },
      {
        id: "future",
        date: new Date("2026-09-08T00:00:00.000Z"),
        startMinute: 600,
        slotId: "old",
        recordCount: 0,
      },
      {
        id: "manual",
        date: new Date("2026-09-03T00:00:00.000Z"),
        startMinute: 540,
        slotId: null,
        recordCount: 0,
      },
    ];
    const diff = diffSchedule(existing, desired, today);
    expect(diff.create.map((item) => item.date.toISOString())).toEqual(["2026-09-08T00:00:00.000Z"]);
    expect(diff.remove.map((item) => item.id)).toEqual(["future"]);
    expect(diff.keep.map((item) => item.id).sort()).toEqual(["manual", "marked"]);
  });

  it("does not remove an unmarked session on today", () => {
    const existing = [
      {
        id: "today",
        date: today,
        startMinute: 600,
        slotId: "old",
        recordCount: 0,
      },
    ];
    const diff = diffSchedule(existing, desired, today);
    expect(diff.remove).toEqual([]);
    expect(diff.keep.map((item) => item.id)).toEqual(["today"]);
  });
});

describe("applyWindow", () => {
  it("uses the full term on first apply, then days after today", () => {
    const start = new Date("2026-08-31T00:00:00.000Z");
    const today = new Date("2026-09-07T00:00:00.000Z");
    expect(applyWindow(start, 2, today, true).start.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(applyWindow(start, 2, today, false).start.toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });
});

describe("isProtectedSession", () => {
  const today = new Date("2026-09-13T00:00:00.000Z");

  it("locks today and earlier generated sessions even without attendance", () => {
    expect(
      isProtectedSession(
        { id: "today", date: today, startMinute: 540, slotId: "slot", recordCount: 0 },
        today,
      ),
    ).toBe(true);
    expect(
      isProtectedSession(
        {
          id: "yesterday",
          date: new Date("2026-09-12T00:00:00.000Z"),
          startMinute: 540,
          slotId: "slot",
          recordCount: 0,
        },
        today,
      ),
    ).toBe(true);
    expect(
      isProtectedSession(
        {
          id: "tomorrow",
          date: new Date("2026-09-14T00:00:00.000Z"),
          startMinute: 540,
          slotId: "slot",
          recordCount: 0,
        },
        today,
      ),
    ).toBe(false);
  });
});
