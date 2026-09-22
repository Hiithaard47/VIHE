import { prisma } from "@/lib/prisma";
import { DEFAULT_SUBJECT_NAME } from "@/modules/subjects/service/subjects";

export async function createCourseRecord(data: {
  name: string;
  code: string;
  description?: string;
  loginMonths: number | null;
}) {
  return prisma.course.create({
    data: {
      ...data,
      subjects: { create: { name: DEFAULT_SUBJECT_NAME } },
    },
  });
}

export async function toggleCourseActiveRecord(courseId: string, isActive: boolean) {
  return prisma.course.update({ where: { id: courseId }, data: { isActive } });
}

export async function updateCourseRecord(
  courseId: string,
  data: { name?: string; code?: string; description?: string | null; loginMonths?: number | null },
) {
  return prisma.course.update({ where: { id: courseId }, data });
}
