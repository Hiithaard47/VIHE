import { prisma } from "@/lib/prisma";

export async function findSubjectWithCourse(courseId: string, subjectId: string) {
  return prisma.courseSubject.findUnique({
    where: { id: subjectId },
    select: { id: true, courseId: true, course: { select: { isActive: true } } },
  });
}

export async function createSubjectForCourse(courseId: string, name: string) {
  return prisma.courseSubject.create({ data: { courseId, name } });
}

export async function updateSubjectName(subjectId: string, name: string) {
  return prisma.courseSubject.update({ where: { id: subjectId }, data: { name } });
}

export async function toggleSubjectActive(subjectId: string, isActive: boolean) {
  return prisma.courseSubject.update({ where: { id: subjectId }, data: { isActive } });
}

export async function deleteSubjectById(subjectId: string) {
  return prisma.courseSubject.delete({ where: { id: subjectId } });
}

export async function countSubjectsForCourse(courseId: string) {
  return prisma.courseSubject.count({ where: { courseId } });
}

export async function countAttendanceForSubject(subjectId: string) {
  return prisma.attendanceRecord.count({ where: { session: { subjectId } } });
}

export async function loadSubjectForDeletion(subjectId: string) {
  return prisma.courseSubject.findUniqueOrThrow({
    where: { id: subjectId },
    select: {
      name: true,
      sessions: { select: { resources: { select: { storageKey: true } } } },
      assignments: {
        select: {
          files: { select: { storageKey: true } },
          submissions: { select: { files: { select: { storageKey: true } } } },
        },
      },
    },
  });
}

export async function findSubjectTeacher(subjectId: string, teacherId: string) {
  return prisma.subjectTeacher.findUnique({
    where: { subjectId_teacherId: { subjectId, teacherId } },
  });
}

export async function addTeacherToSubject(subjectId: string, teacherId: string) {
  return prisma.subjectTeacher.create({ data: { subjectId, teacherId } });
}

export async function removeTeacherFromSubject(subjectId: string, teacherId: string) {
  return prisma.subjectTeacher.deleteMany({ where: { subjectId, teacherId } });
}

export async function findActiveTeacher(teacherId: string) {
  return prisma.user.findFirst({
    where: { id: teacherId, isActive: true },
    select: { id: true, name: true },
  });
}
