-- CreateTable
CREATE TABLE "session_homeworks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_homeworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_homework_submissions" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_homework_submission_files" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_homework_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_homeworks_sessionId_key" ON "session_homeworks"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_homework_submissions_homeworkId_studentId_key" ON "session_homework_submissions"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "session_homework_submissions_studentId_idx" ON "session_homework_submissions"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "session_homework_submission_files_storageKey_key" ON "session_homework_submission_files"("storageKey");

-- CreateIndex
CREATE INDEX "session_homework_submission_files_submissionId_idx" ON "session_homework_submission_files"("submissionId");

-- AddForeignKey
ALTER TABLE "session_homeworks" ADD CONSTRAINT "session_homeworks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_homeworks" ADD CONSTRAINT "session_homeworks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_homework_submissions" ADD CONSTRAINT "session_homework_submissions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "session_homeworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_homework_submissions" ADD CONSTRAINT "session_homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_homework_submission_files" ADD CONSTRAINT "session_homework_submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "session_homework_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
