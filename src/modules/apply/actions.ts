"use server";

import { redirect } from "next/navigation";
import { submitApplication as submitApplicationService, isApplyError } from "./service/apply";

export async function submitApplication(formData: FormData) {
  try {
    await submitApplicationService({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
      message: String(formData.get("message") ?? "") || undefined,
      desiredCourseId: String(formData.get("desiredCourseId") ?? "") || undefined,
      preferredMode: String(formData.get("preferredMode") ?? "") || undefined,
      preferredLanguage: String(formData.get("preferredLanguage") ?? "") || undefined,
      dateOfBirth: String(formData.get("dateOfBirth") ?? "") || undefined,
      country: String(formData.get("country") ?? "") || undefined,
      city: String(formData.get("city") ?? "") || undefined,
      priorExperience: String(formData.get("priorExperience") ?? "") || undefined,
      honeypot: String(formData.get("website") ?? ""),
    });
  } catch (error) {
    if (isApplyError(error) && error.code === "honeypot") {
      redirect("/apply?submitted=1");
    }
    throw error;
  }

  redirect("/apply?submitted=1");
}
