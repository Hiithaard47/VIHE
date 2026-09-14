-- Course-level enrollment (replaces batch_enrollments)
CREATE TABLE "course_enrollments" (
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("courseId","studentId")
);

INSERT INTO "course_enrollments" ("courseId", "studentId", "createdAt")
SELECT DISTINCT b."courseId", be."studentId", MIN(be."createdAt")
FROM "batch_enrollments" be
JOIN "course_batches" b ON b."id" = be."batchId"
GROUP BY b."courseId", be."studentId";

CREATE INDEX "course_enrollments_studentId_idx" ON "course_enrollments"("studentId");

ALTER TABLE "course_enrollments"
  ADD CONSTRAINT "course_enrollments_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_enrollments"
  ADD CONSTRAINT "course_enrollments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "batch_enrollments";

-- Drop FKs that reference course_batches before rename
ALTER TABLE "batch_teachers" DROP CONSTRAINT "batch_teachers_batchId_fkey";
ALTER TABLE "class_sessions" DROP CONSTRAINT "class_sessions_batchId_fkey";
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_batchId_fkey";

-- Rename batch → subject tables/columns
ALTER TABLE "course_batches" RENAME TO "course_subjects";
ALTER TABLE "course_subjects" RENAME CONSTRAINT "course_batches_pkey" TO "course_subjects_pkey";
ALTER TABLE "course_subjects" RENAME CONSTRAINT "course_batches_courseId_fkey" TO "course_subjects_courseId_fkey";
ALTER INDEX "course_batches_courseId_name_key" RENAME TO "course_subjects_courseId_name_key";

ALTER TABLE "batch_teachers" RENAME TO "subject_teachers";
ALTER TABLE "subject_teachers" RENAME COLUMN "batchId" TO "subjectId";
ALTER TABLE "subject_teachers" RENAME CONSTRAINT "batch_teachers_pkey" TO "subject_teachers_pkey";
ALTER TABLE "subject_teachers" RENAME CONSTRAINT "batch_teachers_teacherId_fkey" TO "subject_teachers_teacherId_fkey";
ALTER INDEX "batch_teachers_teacherId_idx" RENAME TO "subject_teachers_teacherId_idx";

ALTER TABLE "class_sessions" RENAME COLUMN "batchId" TO "subjectId";
ALTER INDEX "class_sessions_batchId_date_startMinute_idx" RENAME TO "class_sessions_subjectId_date_startMinute_idx";

ALTER TABLE "assignments" RENAME COLUMN "batchId" TO "subjectId";
ALTER INDEX "assignments_batchId_idx" RENAME TO "assignments_subjectId_idx";

-- Recreate FKs against course_subjects
ALTER TABLE "subject_teachers"
  ADD CONSTRAINT "subject_teachers_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "course_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "course_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignments"
  ADD CONSTRAINT "assignments_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "course_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
