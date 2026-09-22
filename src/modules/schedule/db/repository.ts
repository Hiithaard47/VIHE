import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function updateSubjectTerm(
  subjectId: string,
  data: { termStart: Date; weekCount: number },
) {
  return prisma.courseSubject.update({ where: { id: subjectId }, data });
}

export async function findActiveCategory(categoryId: string) {
  return prisma.sessionCategory.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
}

export async function findSessionSource(sessionId: string) {
  return prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      subjectId: true,
      name: true,
      categoryId: true,
      startMinute: true,
      endMinute: true,
      subject: { select: { courseId: true } },
    },
  });
}

export async function loadCourseScheduleData(
  courseId: string,
  subjectWhere: Prisma.CourseSubjectWhereInput,
) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: {
      subjects: {
        where: subjectWhere,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          termStart: true,
          weekCount: true,
          sessions: {
            select: {
              id: true,
              date: true,
              name: true,
              startMinute: true,
              endMinute: true,
              categoryId: true,
              category: { select: { name: true } },
              _count: { select: { records: true } },
            },
          },
        },
      },
    },
  });
}

export async function loadActiveCategories() {
  return prisma.sessionCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
