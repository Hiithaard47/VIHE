-- Teacher home / scope: batch_teachers looked up by teacherId
CREATE INDEX "batch_teachers_teacherId_idx" ON "batch_teachers"("teacherId");

-- Sibling-batch enroll check and student portal: enrollments by studentId
CREATE INDEX "batch_enrollments_studentId_idx" ON "batch_enrollments"("studentId");

-- Clash check, week grid, attendance matrix, student session list
CREATE INDEX "class_sessions_batchId_date_startMinute_idx"
  ON "class_sessions"("batchId", "date", "startMinute");

-- Session uploads / resources list
CREATE INDEX "session_resources_sessionId_idx" ON "session_resources"("sessionId");

-- Course assignments list
CREATE INDEX "assignments_batchId_idx" ON "assignments"("batchId");

-- Student submissions
CREATE INDEX "assignment_submissions_studentId_idx" ON "assignment_submissions"("studentId");

-- Admin student attendance history
CREATE INDEX "attendance_records_studentId_idx" ON "attendance_records"("studentId");

-- Pending applications ordered by createdAt
CREATE INDEX "student_applications_status_createdAt_idx"
  ON "student_applications"("status", "createdAt");
