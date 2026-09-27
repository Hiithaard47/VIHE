"use client";

import { useEffect, useState } from "react";
import {
  attendancePercent,
  categoryAttendancePolicy,
  isAtRisk,
} from "@/modules/attendance/service/policy";

type Student = { id: string; name: string; rollNumber: string };

type Category = {
  id: string;
  name: string;
  minAttendancePercent: number | null;
};

type Assignment = {
  id: string;
  title: string;
  maxMarks: number;
  latestSubmissions: [string, { studentId: string; marks: number | null; attemptNumber: number }][];
};

type Subject = {
  id: string;
  name: string;
  assignments: Assignment[];
};

type SerializedData = {
  course: {
    name: string;
    code: string;
    lateCountsAsAttended: boolean;
    excusedCountsAsAttended: boolean;
  };
  teachers: string[];
  categories: Category[];
  subjects: Subject[];
  students: Student[];
  printedAt: string;
};

type StudentCalculations = {
  studentId: string;
  assignmentTotals: { totalPossible: number; totalScored: number };
  categoryAttendance: {
    categoryId: string;
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  }[];
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function StudentReportCard({
  data,
  student,
  calculations,
}: {
  data: SerializedData;
  student: Student;
  calculations: StudentCalculations;
}) {
  const { totalPossible, totalScored } = calculations.assignmentTotals;
  const overallPercentage =
    totalPossible > 0 ? Math.round((totalScored / totalPossible) * 100) : null;

  const assignments = data.subjects.flatMap((subject) =>
    subject.assignments.map((assignment) => {
      const submissionsMap = new Map(assignment.latestSubmissions);
      const submission = submissionsMap.get(student.id);
      return {
        subjectName: subject.name,
        assignmentId: assignment.id,
        title: assignment.title,
        maxMarks: assignment.maxMarks,
        submission,
      };
    }),
  );

  // Create a map for quick lookup of category attendance
  const attendanceMap = new Map(
    calculations.categoryAttendance.map((ca) => [
      ca.categoryId,
      {
        PRESENT: ca.PRESENT,
        ABSENT: ca.ABSENT,
        LATE: ca.LATE,
        EXCUSED: ca.EXCUSED,
      },
    ]),
  );

  return (
    <article className="course-report-card mx-auto min-h-screen print:min-h-0 max-w-4xl bg-white p-8 text-black print:break-after-page print:max-w-none print:p-0">
      {/* Header */}
      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold">
              Course Report Card
            </h1>
            <p className="mt-1 text-sm">
              {data.course.name} · {data.course.code}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold">Printed</p>
            <p>{formatDate(data.printedAt)}</p>
          </div>
        </div>

        {/* Student details */}
        <dl className="grid gap-2 text-sm">
          <div className="flex">
            <dt className="w-24 font-semibold">Student</dt>
            <dd>{student.name}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-semibold">Roll No.</dt>
            <dd>{student.rollNumber}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 font-semibold">Teachers</dt>
            <dd>{data.teachers.length > 0 ? data.teachers.join(", ") : "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Attendance Summary */}
      {data.categories.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">
            Attendance Summary
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="px-2 py-1 text-left font-semibold">
                  Session Category
                </th>
                <th className="px-2 py-1 text-left font-semibold">Attended</th>
                <th className="px-2 py-1 text-left font-semibold">Percentage</th>
                <th className="px-2 py-1 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((category) => {
                const tally = attendanceMap.get(category.id);
                if (!tally) return null;

                const policy = categoryAttendancePolicy(data.course, category);
                const percent = attendancePercent(tally, policy);
                const atRisk = isAtRisk(percent, policy);

                const attended =
                  tally.PRESENT +
                  (data.course.lateCountsAsAttended ? tally.LATE : 0) +
                  (data.course.excusedCountsAsAttended ? tally.EXCUSED : 0);
                const marked =
                  tally.PRESENT + tally.ABSENT + tally.LATE + tally.EXCUSED;

                return (
                  <tr key={category.id} className="border-b border-gray-300">
                    <td className="px-2 py-1">{category.name}</td>
                    <td className="px-2 py-1">
                      {marked > 0 ? `${attended} / ${marked}` : "—"}
                    </td>
                    <td className="px-2 py-1">
                      {percent === null ? "—" : `${percent}%`}
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        atRisk ? "font-semibold" : ""
                      }`}
                    >
                      {atRisk ? "Below threshold" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Assignment Breakdown */}
      {assignments.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">
            Assignment Breakdown
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="px-2 py-1 text-left font-semibold">Subject</th>
                <th className="px-2 py-1 text-left font-semibold">
                  Assignment
                </th>
                <th className="px-2 py-1 text-right font-semibold">Max</th>
                <th className="px-2 py-1 text-right font-semibold">Obtained</th>
                <th className="px-2 py-1 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.assignmentId} className="border-b border-gray-300">
                  <td className="px-2 py-1">{item.subjectName}</td>
                  <td className="px-2 py-1">{item.title}</td>
                  <td className="px-2 py-1 text-right">{item.maxMarks}</td>
                  
                  {/* FIX: Use optional chaining and nullish coalescing */}
                  <td className="px-2 py-1 text-right">
                    {item.submission?.marks ?? "—"}
                  </td>
                  
                  {/* FIX: Check for !item.submission instead of === null */}
                  <td className="px-2 py-1">
                    {!item.submission
                      ? "Not submitted"
                      : item.submission.marks === null
                        ? "Not graded"
                        : "Graded"}
                  </td>
                </tr>
              ))}
              {/* Final totals row remains the same */}
              <tr className="border-t-2 border-black font-semibold">
                <td colSpan={2} className="px-2 py-2">
                  Final Course Grade
                </td>
                <td className="px-2 py-2 text-right">{totalPossible}</td>
                <td className="px-2 py-2 text-right">{totalScored}</td>
                <td className="px-2 py-2">
                  {overallPercentage === null ? "—" : `${overallPercentage}%`}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}

export function ReportCardPrintContent({
  data,
  studentCalculations,
}: {
  data: SerializedData;
  studentCalculations: StudentCalculations[];
}) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // We only need one useEffect now, and it runs safely on the client
  useEffect(() => {
    const checkSelected = () => {
      const element = document.querySelector("[data-selected-students]");
      if (element) {
        const attr = element.getAttribute("data-selected-students");
        if (attr) {
          try {
            const ids = JSON.parse(attr);
            setSelectedStudentIds(ids);
          } catch (e) {
            console.error("Failed to parse selected students:", e);
          }
        }
      }
    };

    checkSelected();

    const observer = new MutationObserver(checkSelected);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-selected-students"],
    });

    return () => observer.disconnect();
  }, []);

  const studentsToDisplay =
    selectedStudentIds.length > 0
      ? data.students.filter((s) => selectedStudentIds.includes(s.id))
      : [];

  // Create a map for quick lookup of calculations
  const calculationsMap = new Map(
    studentCalculations.map((calc) => [calc.studentId, calc]),
  );

  return (
    <section
      className="course-report-cards hidden print:block"
      aria-label="Course report cards"
    >
      {studentsToDisplay.length > 0 ? (
        studentsToDisplay.map((student) => {
          const calculations = calculationsMap.get(student.id);
          if (!calculations) return null;
          return (
            <StudentReportCard
              key={student.id}
              data={data}
              student={student}
              calculations={calculations}
            />
          );
        })
      ) : (
        <div className="p-8 text-center text-sm text-muted print:hidden">
          No students selected for printing.
        </div>
      )}
    </section>
  );
}