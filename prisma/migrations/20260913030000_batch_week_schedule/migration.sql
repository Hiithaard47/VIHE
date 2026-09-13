ALTER TABLE "course_batches" ADD COLUMN "termStart" TIMESTAMP(3);
ALTER TABLE "course_batches" ADD COLUMN "weekCount" INTEGER;

ALTER TABLE "course_schedule_slots" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "course_schedule_slots" ADD COLUMN "name" TEXT;

DELETE FROM "course_schedule_slots" WHERE "categoryId" IS NULL OR "name" IS NULL;

ALTER TABLE "course_schedule_slots" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "course_schedule_slots" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "course_schedule_slots" ADD CONSTRAINT "course_schedule_slots_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "session_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
