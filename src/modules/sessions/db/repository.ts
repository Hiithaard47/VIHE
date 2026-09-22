import { prisma } from "@/lib/prisma";

export async function findSessionClash(subjectId: string, date: Date, startMinute: number) {
  return prisma.classSession.findFirst({
    where: { subjectId, date, startMinute },
    select: { id: true },
  });
}

export async function createSessionRecord(data: {
  subjectId: string;
  categoryId: string;
  date: Date;
  name: string;
  startMinute: number | null;
  endMinute: number | null;
  createdById: string;
}) {
  return prisma.classSession.create({ data, select: { id: true } });
}

export async function findSessionWithSubject(sessionId: string) {
  return prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      date: true,
      subjectId: true,
      startMinute: true,
      subject: { select: { courseId: true } },
      _count: { select: { records: true } },
    },
  });
}

export async function findSessionClashExcluding(
  subjectId: string,
  date: Date,
  startMinute: number,
  excludeId: string,
) {
  return prisma.classSession.findFirst({
    where: { subjectId, date, startMinute, id: { not: excludeId } },
    select: { id: true },
  });
}

export async function updateSessionDateRecord(
  sessionId: string,
  data: { date: Date; startMinute: number; endMinute: number },
) {
  return prisma.classSession.update({ where: { id: sessionId }, data });
}

export async function deleteSessionRecord(sessionId: string) {
  return prisma.classSession.delete({ where: { id: sessionId } });
}

export async function updateSessionDate(sessionId: string, date: Date) {
  return prisma.classSession.update({ where: { id: sessionId }, data: { date } });
}

export async function findActiveCategory(categoryId: string) {
  return prisma.sessionCategory.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// UI-view queries
// ---------------------------------------------------------------------------

export async function loadCourseSessionsData(courseId: string, selectedSubjectId?: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: {
      description: true,
      subjects: {
        where: selectedSubjectId ? { id: selectedSubjectId } : { isActive: true },
        select: {
          id: true,
          name: true,
          isActive: true,
          sessions: {
            orderBy: [{ date: "asc" }, { startMinute: "asc" }],
            include: {
              category: { select: { id: true, name: true } },
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

export async function findSessionSubjectId(sessionId: string) {
  return prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { subjectId: true },
  });
}

export async function loadSessionDetail(sessionId: string) {
  return prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      category: { select: { name: true, allowsResources: true } },
      subject: {
        select: {
          id: true,
          course: {
            select: {
              id: true,
              name: true,
              defaultStatus: true,
              enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
            },
          },
        },
      },
      records: { include: { markedBy: { select: { name: true } } } },
      resources: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true },
      },
      homework: {
        include: {
          submissions: {
            include: {
              student: { select: { id: true, name: true, rollNumber: true } },
              files: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true } },
            },
            orderBy: { student: { rollNumber: "asc" } },
          },
        },
      },
    },
  });
}
