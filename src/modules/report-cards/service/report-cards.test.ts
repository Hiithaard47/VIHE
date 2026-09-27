import { describe, it, expect } from "vitest";
import {
  calculateStudentCategoryAttendance,
  calculateStudentAssignmentTotals,
} from "./queries";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
} from "@/modules/attendance/service/policy";

describe("report cards service", () => {
  describe("calculateStudentCategoryAttendance", () => {
    it("tallies attendance by status", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [],
          sessions: [
            {
              category: {
                id: "cat1",
                name: "Class",
                isActive: true,
                minAttendancePercent: null,
              },
              records: [
                { studentId: "stu1", status: "PRESENT" as const },
                { studentId: "stu1", status: "PRESENT" as const },
                { studentId: "stu1", status: "ABSENT" as const },
                { studentId: "stu1", status: "LATE" as const },
              ],
            },
          ],
        },
      ];

      const tally = calculateStudentCategoryAttendance(
        mockSubjects,
        "stu1",
        "cat1",
      );

      expect(tally.PRESENT).toBe(2);
      expect(tally.ABSENT).toBe(1);
      expect(tally.LATE).toBe(1);
      expect(tally.EXCUSED).toBe(0);
    });

    it("returns empty tally for student with no records", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [],
          sessions: [
            {
              category: {
                id: "cat1",
                name: "Class",
                isActive: true,
                minAttendancePercent: null,
              },
              records: [{ studentId: "other_student", status: "PRESENT" as const }],
            },
          ],
        },
      ];

      const tally = calculateStudentCategoryAttendance(
        mockSubjects,
        "stu1",
        "cat1",
      );

      expect(tally.PRESENT).toBe(0);
      expect(tally.ABSENT).toBe(0);
    });

    it("respects attendance policy (late counts)", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [],
          sessions: [
            {
              category: {
                id: "cat1",
                name: "Class",
                isActive: true,
                minAttendancePercent: 75,
              },
              records: [
                { studentId: "stu1", status: "PRESENT" as const },
                { studentId: "stu1", status: "PRESENT" as const },
                { studentId: "stu1", status: "LATE" as const },
              ],
            },
          ],
        },
      ];

      const tally = calculateStudentCategoryAttendance(
        mockSubjects,
        "stu1",
        "cat1",
      );

      const policyWithLate = categoryAttendancePolicy(
        { lateCountsAsAttended: true, excusedCountsAsAttended: false },
        { minAttendancePercent: 75 },
      );
      const percentWithLate = attendancePercent(tally, policyWithLate);

      const policyWithoutLate = categoryAttendancePolicy(
        { lateCountsAsAttended: false, excusedCountsAsAttended: false },
        { minAttendancePercent: 75 },
      );
      const percentWithoutLate = attendancePercent(tally, policyWithoutLate);

      expect(percentWithLate).toBe(100); // 3/3
      expect(percentWithoutLate).toBe(67); // 2/3
    });
  });

  describe("calculateStudentAssignmentTotals", () => {
    it("sums marks correctly", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [
            {
              id: "asg1",
              title: "Quiz",
              maxMarks: 20,
              latestSubmissions: new Map([["stu1", { marks: 16, attemptNumber: 1, studentId: "stu1" }]]),
            },
            {
              id: "asg2",
              title: "Essay",
              maxMarks: 30,
              latestSubmissions: new Map([["stu1", { marks: 25, attemptNumber: 1, studentId: "stu1" }]]),
            },
          ],
          sessions: [],
        },
      ];

      const { totalPossible, totalScored } =
        calculateStudentAssignmentTotals(mockSubjects, "stu1");

      expect(totalPossible).toBe(50);
      expect(totalScored).toBe(41);
    });

    it("ignores ungraded submissions", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [
            {
              id: "asg1",
              title: "Quiz",
              maxMarks: 20,
              latestSubmissions: new Map([["stu1", { marks: null, attemptNumber: 1, studentId: "stu1" }]]),
            },
          ],
          sessions: [],
        },
      ];

      const { totalPossible, totalScored } =
        calculateStudentAssignmentTotals(mockSubjects, "stu1");

      expect(totalPossible).toBe(20);
      expect(totalScored).toBe(0);
    });

    it("returns zero when student has no assignments", () => {
      const mockSubjects = [
        {
          id: "subj1",
          name: "Math",
          assignments: [],
          sessions: [],
        },
      ];

      const { totalPossible, totalScored } =
        calculateStudentAssignmentTotals(mockSubjects, "stu1");

      expect(totalPossible).toBe(0);
      expect(totalScored).toBe(0);
    });
  });
});