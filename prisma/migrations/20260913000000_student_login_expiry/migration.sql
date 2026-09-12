-- AlterTable
ALTER TABLE "courses" ADD COLUMN "loginMonths" INTEGER;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "loginExpiresAt" TIMESTAMP(3);
