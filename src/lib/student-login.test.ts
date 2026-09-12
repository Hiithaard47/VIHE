import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  isStudentLoginExpired,
  loginMonthsForCourseCode,
  parseLoginMonthsInput,
  resolveLoginExpiresAt,
} from "@/lib/student-login";

describe("loginMonthsForCourseCode", () => {
  it("gives six months for BSA and BPV", () => {
    expect(loginMonthsForCourseCode("BSA")).toBe(6);
    expect(loginMonthsForCourseCode("bpv-2026")).toBe(6);
  });

  it("gives one year for BS", () => {
    expect(loginMonthsForCourseCode("BS")).toBe(12);
    expect(loginMonthsForCourseCode("bs1")).toBe(12);
  });

  it("gives four years for BV and BVA", () => {
    expect(loginMonthsForCourseCode("BV")).toBe(48);
    expect(loginMonthsForCourseCode("BVA")).toBe(48);
  });

  it("returns null for other codes", () => {
    expect(loginMonthsForCourseCode("LTE")).toBeNull();
    expect(loginMonthsForCourseCode("")).toBeNull();
  });
});

describe("resolveLoginExpiresAt", () => {
  const now = new Date("2026-09-13T15:00:00.000Z");

  it("keeps an expiry the CA already set", () => {
    const existing = new Date("2027-01-01T00:00:00.000Z");
    expect(resolveLoginExpiresAt(existing, 12, now)).toEqual(existing);
  });

  it("adds course months from today when none is set", () => {
    expect(resolveLoginExpiresAt(null, 12, now)).toEqual(addCalendarMonths(now, 12));
    expect(resolveLoginExpiresAt(null, null, now)).toBeNull();
  });
});

describe("parseLoginMonthsInput", () => {
  it("treats empty as infer-from-code and accepts the known lengths", () => {
    expect(parseLoginMonthsInput("")).toBeNull();
    expect(parseLoginMonthsInput("12")).toBe(12);
    expect(parseLoginMonthsInput("9")).toBeUndefined();
  });
});

describe("isStudentLoginExpired", () => {
  const today = new Date("2026-09-13T08:00:00.000Z");

  it("allows login with no expiry or on the expiry date", () => {
    expect(isStudentLoginExpired(null, today)).toBe(false);
    expect(isStudentLoginExpired(new Date("2026-09-13T00:00:00.000Z"), today)).toBe(false);
  });

  it("blocks login after the expiry calendar day", () => {
    expect(isStudentLoginExpired(new Date("2026-09-12T00:00:00.000Z"), today)).toBe(true);
  });
});
