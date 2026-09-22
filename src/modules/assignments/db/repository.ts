import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// createAssignment
// ---------------------------------------------------------------------------

export async function createAssignment(data: {
  subjectId: string;
  title: string;
  instructions: string | null;
  dueDate: Date | null;
  maxMarks: number;
  createdById: string;
}) {
  return prisma.assignment.create({ data });
}

export async function deleteAssignmentRecord(id: string) {
  return prisma.assignment.delete({ where: { id } });
}

/** Best-effort cleanup after a failed upload; swallows missing-row errors. */
export async function rollbackAssignmentRecord(id: string) {
  return prisma.assignment.delete({ where: { id } }).catch(() => {});
}

export async function createAssignmentFiles(
  data: Array<{
    id: string;
    assignmentId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  }>,
) {
  return prisma.assignmentFile.createMany({ data });
}

// ---------------------------------------------------------------------------
// gradeSubmission
// ---------------------------------------------------------------------------

export async function findAssignmentInCourse(assignmentId: string, courseId: string) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    select: { id: true, maxMarks: true, subjectId: true },
  });
}

export async function findSubmission(submissionId: string, assignmentId: string, studentId: string) {
  return prisma.assignmentSubmission.findFirst({
    where: { id: submissionId, assignmentId, studentId },
    select: { id: true, attemptNumber: true },
  });
}

export async function findLatestSubmission(assignmentId: string, studentId: string) {
  return prisma.assignmentSubmission.findFirst({
    where: { assignmentId, studentId },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, attemptNumber: true },
  });
}

export async function updateSubmissionGrade(
  submissionId: string,
  data: { marks: number; feedback: string | null; gradedById: string },
) {
  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { ...data, gradedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// deleteAssignment
// ---------------------------------------------------------------------------

export async function findAssignmentWithFiles(assignmentId: string, courseId: string) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    include: {
      files: { select: { storageKey: true } },
      submissions: { include: { files: { select: { storageKey: true } } } },
    },
  });
}

// ---------------------------------------------------------------------------
// submitAssignment (student)
// ---------------------------------------------------------------------------

export async function findAssignmentForSubmit(assignmentId: string, courseId: string) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, subject: { courseId } },
    select: { id: true, dueDate: true },
  });
}

export async function findStudentAttempts(assignmentId: string, studentId: string) {
  return prisma.assignmentSubmission.findMany({
    where: { assignmentId, studentId },
    orderBy: { attemptNumber: "desc" },
    select: { id: true, attemptNumber: true, marks: true },
  });
}

export async function createSubmission(data: {
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
}) {
  return prisma.assignmentSubmission.create({ data });
}

export async function deleteSubmission(id: string) {
  return prisma.assignmentSubmission.delete({ where: { id } }).catch(() => {});
}

export async function createSubmissionFiles(
  data: Array<{
    id: string;
    submissionId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storageKey: string;
  }>,
) {
  return prisma.assignmentSubmissionFile.createMany({ data });
}

// ---------------------------------------------------------------------------
// UI queries
// ---------------------------------------------------------------------------

export async function listCourseAssignments(where: Prisma.AssignmentWhereInput) {
  return prisma.assignment.findMany({
    where,
    include: {
      submissions: { select: { studentId: true, marks: true, attemptNumber: true } },
      subject: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listWritableSubjects(
  courseId: string,
  scopeWhere: Prisma.CourseSubjectWhereInput,
) {
  return prisma.courseSubject.findMany({
    where: { courseId, ...scopeWhere },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
}

export async function countCourseEnrollments(courseId: string) {
  return prisma.courseEnrollment.count({ where: { courseId } });
}

export async function findAssignmentDetail(
  assignmentId: string,
  where: Prisma.AssignmentWhereInput,
) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, ...where },
    include: {
      files: { orderBy: { createdAt: "asc" } },
      subject: {
        select: {
          course: {
            select: {
              enrollments: { include: { student: true }, orderBy: { student: { rollNumber: "asc" } } },
            },
          },
        },
      },
      submissions: {
        include: { files: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ studentId: "asc" }, { attemptNumber: "desc" }],
      },
    },
  });
}
