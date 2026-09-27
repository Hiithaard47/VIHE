import {
  getCourseReportCardData,
  calculateStudentCategoryAttendance,
  calculateStudentAssignmentTotals,
} from "../service/queries";
import { ReportCardPrintContent } from "./report-card-print-content";

export async function CourseReportCardPrintView({
  courseId,
}: {
  courseId: string;
}) {
  const rawData = await getCourseReportCardData(courseId);

  if (!rawData) return null;

  // 1. Calculate all attendance and assignment data on the server
  // Note: We use rawData here because calculations expect Maps to be intact
  const studentCalculations = rawData.students.map((student) => {
    const assignmentTotals = calculateStudentAssignmentTotals(
      rawData.subjects,
      student.id,
    );

    const categoryAttendance = rawData.categories.map((category) => {
      const tally = calculateStudentCategoryAttendance(
        rawData.subjects,
        student.id,
        category.id,
      );
      
      // FIX: Flatten the tally object to exactly match the 
      // StudentCalculations type expected by the client component
      return {
        categoryId: category.id,
        PRESENT: tally.PRESENT,
        ABSENT: tally.ABSENT,
        LATE: tally.LATE,
        EXCUSED: tally.EXCUSED,
      };
    });

    return {
      studentId: student.id,
      assignmentTotals,
      categoryAttendance,
    };
  });

  // 2. Serialize Data for the Client Component Boundary
  // Converts un-serializable objects (Maps, Dates) into standard JSON formats
  const serializedData = {
    ...rawData,
    printedAt: rawData.printedAt.toISOString(), // FIX: Convert Date to ISO string
    subjects: rawData.subjects.map((subject) => ({
      ...subject,
      assignments: subject.assignments.map((assignment) => ({
        ...assignment,
        // FIX: Convert Map to an Array of Tuples for safe RSC payload transfer
        latestSubmissions: Array.from(assignment.latestSubmissions.entries()),
      })),
    })),
  };

  return (
    <ReportCardPrintContent
      data={serializedData}
      studentCalculations={studentCalculations}
    />
  );
}