-- CreateTable
CREATE TABLE "course_batches" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_batches_courseId_name_key" ON "course_batches"("courseId", "name");

-- Backfill one default batch for every existing course.
INSERT INTO "course_batches" ("id", "courseId", "name", "isActive", "createdAt", "updatedAt")
SELECT 'cb_' || substr(md5(c."id"), 1, 22), c."id", 'Default', true, c."createdAt", c."updatedAt"
FROM "courses" c;

-- CreateTable
CREATE TABLE "batch_teachers" (
    "batchId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "batch_teachers_pkey" PRIMARY KEY ("batchId","teacherId")
);

-- Backfill course teachers onto each course's default batch.
INSERT INTO "batch_teachers" ("batchId", "teacherId")
SELECT b."id", ct."teacherId"
FROM "course_teachers" ct
JOIN "course_batches" b
  ON b."courseId" = ct."courseId" AND b."name" = 'Default';

-- CreateTable
CREATE TABLE "batch_enrollments" (
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_enrollments_pkey" PRIMARY KEY ("batchId","studentId")
);

-- Backfill course enrollments onto each course's default batch.
INSERT INTO "batch_enrollments" ("batchId", "studentId", "createdAt")
SELECT b."id", ce."studentId", ce."createdAt"
FROM "course_enrollments" ce
JOIN "course_batches" b
  ON b."courseId" = ce."courseId" AND b."name" = 'Default';

-- Remove old foreign keys before changing the source columns.
ALTER TABLE "class_sessions" DROP CONSTRAINT "class_sessions_courseId_fkey";
ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_courseId_fkey";
ALTER TABLE "course_enrollments" DROP CONSTRAINT "course_enrollments_studentId_fkey";
ALTER TABLE "course_schedule_slots" DROP CONSTRAINT "course_schedule_slots_courseId_fkey";
ALTER TABLE "course_teachers" DROP CONSTRAINT "course_teachers_courseId_fkey";
ALTER TABLE "course_teachers" DROP CONSTRAINT "course_teachers_teacherId_fkey";

-- Move sessions and schedule slots to their default batch.
ALTER TABLE "class_sessions" ADD COLUMN "batchId" TEXT;
UPDATE "class_sessions" s
SET "batchId" = b."id"
FROM "course_batches" b
WHERE b."courseId" = s."courseId" AND b."name" = 'Default';
ALTER TABLE "class_sessions" ALTER COLUMN "batchId" SET NOT NULL;
ALTER TABLE "class_sessions" DROP COLUMN "courseId";

DROP INDEX IF EXISTS "course_schedule_slots_courseId_weekday_startMinute_key";
ALTER TABLE "course_schedule_slots" ADD COLUMN "batchId" TEXT;
UPDATE "course_schedule_slots" s
SET "batchId" = b."id"
FROM "course_batches" b
WHERE b."courseId" = s."courseId" AND b."name" = 'Default';
ALTER TABLE "course_schedule_slots" ALTER COLUMN "batchId" SET NOT NULL;
ALTER TABLE "course_schedule_slots" DROP COLUMN "courseId";

-- Drop old course-scoped relationship tables.
DROP TABLE "course_enrollments";
DROP TABLE "course_teachers";

-- CreateIndex
CREATE UNIQUE INDEX "course_schedule_slots_batchId_weekday_startMinute_key"
ON "course_schedule_slots"("batchId", "weekday", "startMinute");

-- AddForeignKey
ALTER TABLE "course_batches"
  ADD CONSTRAINT "course_batches_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_teachers"
  ADD CONSTRAINT "batch_teachers_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "course_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_teachers"
  ADD CONSTRAINT "batch_teachers_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_enrollments"
  ADD CONSTRAINT "batch_enrollments_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "course_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "batch_enrollments"
  ADD CONSTRAINT "batch_enrollments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_schedule_slots"
  ADD CONSTRAINT "course_schedule_slots_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "course_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "course_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
