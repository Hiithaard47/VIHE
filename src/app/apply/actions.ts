"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const applicationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
  desiredCourseId: z.string().optional(),
  preferredMode: z.enum(["ONLINE", "HYBRID", "ON_SITE"]).optional(),
  preferredLanguage: z.enum(["ENGLISH", "HINDI"]).optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  priorExperience: z.string().optional(),
});

export async function submitApplication(formData: FormData) {
  // Honeypot: real visitors never see or fill this field (hidden off-screen).
  // A filled value means a bot — pretend success without writing anything.
  if (String(formData.get("website") ?? "").length > 0) {
    redirect("/apply?submitted=1");
  }

  const parsed = applicationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message") || undefined,
    desiredCourseId: formData.get("desiredCourseId") || undefined,
    preferredMode: formData.get("preferredMode") || undefined,
    preferredLanguage: formData.get("preferredLanguage") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    country: formData.get("country") || undefined,
    city: formData.get("city") || undefined,
    priorExperience: formData.get("priorExperience") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const { dateOfBirth, ...rest } = parsed.data;

  await prisma.studentApplication.create({
    data: {
      ...rest,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    },
  });

  redirect("/apply?submitted=1");
}
