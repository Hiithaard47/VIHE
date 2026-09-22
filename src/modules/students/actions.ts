"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import {
  createStudent as createStudentService,
  updateStudentDetails as updateStudentDetailsService,
  updateStudentEnrollments as updateStudentEnrollmentsService,
  toggleStudentActive as toggleStudentActiveService,
  approveApplication as approveApplicationService,
  rejectApplication as rejectApplicationService,
  isStudentError,
} from "./service/students";

const PATH = "/admin/students";
const APPLICATIONS_PATH = `${PATH}?tab=applications`;

const createStudentSchema = z.object({
  name: z.string().min(1),
  rollNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  password: z.string().optional().default(""),
});

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  rollNumber: z.string().trim().min(1, "Roll number is required."),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  password: z.string().optional().default(""),
  loginExpiresAt: z.string().optional().default(""),
});

function getCourseSelections(formData: FormData) {
  const visible = formData.getAll("visibleCourse").filter((value): value is string => typeof value === "string");
  if (visible.length > 0) {
    return visible.map((courseId) => ({
      courseId,
      enrolled: formData.get(`course-${courseId}`) === "on",
    }));
  }
  return Array.from(formData.entries())
    .filter(([key]) => key.startsWith("course-"))
    .map(([key, value]) => ({
      courseId: key.slice("course-".length),
      enrolled: value === "on",
    }));
}

function fail(path: string, error: unknown): never {
  if (isStudentError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function createStudent(formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  const parsed = createStudentSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    password: formData.get("password") || "",
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    const result = await createStudentService({
      ...parsed.data,
      courseSelections: getCourseSelections(formData),
    });
    revalidatePath(PATH);
    redirect(flashUrl(PATH, "success", `${result.name} was added.`));
  } catch (error) {
    fail(PATH, error);
  }
}

export async function updateStudentDetails(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}/details`;

  const parsed = detailsSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber"),
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    password: formData.get("password") || "",
    loginExpiresAt: formData.get("loginExpiresAt") || "",
  });
  if (!parsed.success) redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await updateStudentDetailsService({
      studentId,
      name: parsed.data.name,
      rollNumber: parsed.data.rollNumber,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password || undefined,
      loginExpiresAt: parsed.data.loginExpiresAt || undefined,
    });
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(PATH);
  revalidatePath(`/admin/students/${studentId}`);
  redirect(flashUrl(path, "success", "Student details saved."));
}

export async function updateStudentEnrollments(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}`;

  try {
    await updateStudentEnrollmentsService({
      studentId,
      courseSelections: getCourseSelections(formData),
    });
  } catch (error) {
    fail(path, error);
  }

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", "Enrollment updated."));
}

export async function toggleStudentActive(studentId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const path = `/admin/students/${studentId}`;
  const nextActive = formData.get("nextActive") === "true";
  await toggleStudentActiveService(studentId, nextActive);

  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Student restored." : "Student archived."));
}

export async function approveApplication(applicationId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);

  try {
    const result = await approveApplicationService({
      applicationId,
      rollNumber: String(formData.get("rollNumber") ?? "").trim(),
      reviewerId: session.user.id,
    });
    revalidatePath(PATH);
    redirect(flashUrl(APPLICATIONS_PATH, "success", `${result.name} was approved.`));
  } catch (error) {
    fail(APPLICATIONS_PATH, error);
  }
}

export async function rejectApplication(applicationId: string) {
  const session = await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  await rejectApplicationService(applicationId, session.user.id);

  revalidatePath(PATH);
  redirect(flashUrl(APPLICATIONS_PATH, "success", "Application rejected."));
}
