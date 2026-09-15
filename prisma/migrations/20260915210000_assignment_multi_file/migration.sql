-- Multi-file support for assignment prompts and student submissions.

CREATE TABLE "assignment_files" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignment_submission_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submission_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assignment_files_storageKey_key" ON "assignment_files"("storageKey");
CREATE INDEX "assignment_files_assignmentId_idx" ON "assignment_files"("assignmentId");
CREATE UNIQUE INDEX "assignment_submission_files_storageKey_key" ON "assignment_submission_files"("storageKey");
CREATE INDEX "assignment_submission_files_submissionId_idx" ON "assignment_submission_files"("submissionId");

ALTER TABLE "assignment_files"
  ADD CONSTRAINT "assignment_files_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignment_submission_files"
  ADD CONSTRAINT "assignment_submission_files_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "assignment_files" ("id", "assignmentId", "fileName", "contentType", "sizeBytes", "storageKey", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || a."id") || substr(a."id", 1, 8),
  a."id",
  a."fileName",
  a."contentType",
  a."sizeBytes",
  a."storageKey",
  a."createdAt"
FROM "assignments" a;

INSERT INTO "assignment_submission_files" ("id", "submissionId", "fileName", "contentType", "sizeBytes", "storageKey", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || s."id") || substr(s."id", 1, 8),
  s."id",
  s."fileName",
  s."contentType",
  s."sizeBytes",
  s."storageKey",
  s."submittedAt"
FROM "assignment_submissions" s;

ALTER TABLE "assignments" DROP COLUMN "fileName",
DROP COLUMN "contentType",
DROP COLUMN "sizeBytes",
DROP COLUMN "storageKey";

ALTER TABLE "assignment_submissions" DROP COLUMN "fileName",
DROP COLUMN "contentType",
DROP COLUMN "sizeBytes",
DROP COLUMN "storageKey";
