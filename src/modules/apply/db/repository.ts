import { prisma } from "@/lib/prisma";

export async function createApplication(data: {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  desiredCourseId?: string;
  preferredMode?: "ONLINE" | "HYBRID" | "ON_SITE";
  preferredLanguage?: "ENGLISH" | "HINDI";
  dateOfBirth?: Date;
  country?: string;
  city?: string;
  priorExperience?: string;
}) {
  return prisma.studentApplication.create({ data });
}
