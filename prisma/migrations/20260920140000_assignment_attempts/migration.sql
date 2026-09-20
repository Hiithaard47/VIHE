-- AlterTable
ALTER TABLE "assignment_submissions" ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX IF EXISTS "assignment_submissions_assignmentId_studentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_attemptNumber_key" ON "assignment_submissions"("assignmentId", "studentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "assignment_submissions_assignmentId_studentId_idx" ON "assignment_submissions"("assignmentId", "studentId");
