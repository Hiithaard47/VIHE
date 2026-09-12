-- CreateEnum
CREATE TYPE "PreferredMode" AS ENUM ('ONLINE', 'HYBRID', 'ON_SITE');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('ENGLISH', 'HINDI');

-- AlterTable
ALTER TABLE "student_applications" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "preferredLanguage" "PreferredLanguage",
ADD COLUMN     "preferredMode" "PreferredMode",
ADD COLUMN     "priorExperience" TEXT;
