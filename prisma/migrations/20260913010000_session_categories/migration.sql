-- CreateTable
CREATE TABLE "session_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAttendancePercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_categories_name_key" ON "session_categories"("name");

INSERT INTO "session_categories" ("id", "name", "minAttendancePercent", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES ('seed_session_category_class', 'Class', 75, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "class_sessions" ADD COLUMN "name" TEXT;
ALTER TABLE "class_sessions" ADD COLUMN "categoryId" TEXT;

UPDATE "class_sessions" SET "name" = COALESCE(NULLIF("topic", ''), 'Class');
UPDATE "class_sessions" SET "categoryId" = 'seed_session_category_class';

ALTER TABLE "class_sessions" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "class_sessions" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "session_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" DROP COLUMN "topic";

ALTER TABLE "courses" DROP COLUMN "minAttendancePercent";
