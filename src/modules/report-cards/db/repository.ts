import { prisma } from "@/lib/prisma";
import { startOfTodayUtc } from "@/lib/time";

export async function loadCourseReportCardData(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: {
      name: true,
      code: true,
      lateCountsAsAttended: true,
      excusedCountsAsAttended: true,
      subjects: {
        where: { isActive: true },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          teachers: {
            select: {
              teacher: { select: { id: true, name: true } },
            },
          },
          assignments: {
            orderBy: [{ createdAt: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              maxMarks: true,
              submissions: {
                select: {
                  studentId: true,
                  attemptNumber: true,
                  marks: true,
                },
              },
            },
          },
          sessions: {
            where: { date: { lte: startOfTodayUtc() } },
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  minAttendancePercent: true,
                },
              },
              records: {
                select: { studentId: true, status: true },
              },
            },
          },
        },
      },
      enrollments: {
        orderBy: { student: { rollNumber: "asc" } },
        select: {
          student: { select: { id: true, name: true, rollNumber: true } },
        },
      },
    },
  });
}