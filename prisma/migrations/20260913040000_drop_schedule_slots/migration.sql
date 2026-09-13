ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "slotId";
DROP TABLE IF EXISTS "course_schedule_slots";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "endDate";
