-- AlterTable
ALTER TABLE "class_sessions" ADD COLUMN     "endMinute" INTEGER,
ADD COLUMN     "slotId" TEXT,
ADD COLUMN     "startMinute" INTEGER;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "defaultStatus" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "excusedCountsAsAttended" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lateCountsAsAttended" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockAfterDays" INTEGER,
ADD COLUMN     "minAttendancePercent" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "course_schedule_slots" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "course_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_schedule_slots_courseId_weekday_startMinute_key" ON "course_schedule_slots"("courseId", "weekday", "startMinute");

-- AddForeignKey
ALTER TABLE "course_schedule_slots" ADD CONSTRAINT "course_schedule_slots_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
