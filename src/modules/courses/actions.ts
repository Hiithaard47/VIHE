"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveCourse, requireCourseConfigure, requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl } from "@/lib/flash";
import { parseDetailsForm } from "./service/course-details";
import { parsePolicyForm } from "@/lib/policy";
import { parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";
import {
  createCourse as createCourseService,
  toggleCourseActive as toggleCourseActiveService,
  updateCourseDetails as updateCourseDetailsService,
  updateCoursePolicy as updateCoursePolicyService,
  isCourseError,
} from "./service/courses";

const PATH = "/admin/courses";

function settingsPath(portal: CoursePortal, courseId: string, adminSuffix: "details" | "policy") {
  return portal === "admin" ? `/admin/courses/${courseId}/${adminSuffix}` : `/teacher/courses/${courseId}/settings`;
}

function revalidateCourse(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/teacher/courses/${courseId}/settings`);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath(`/admin/courses/${courseId}/details`);
  revalidatePath(`/admin/courses/${courseId}/policy`);
  revalidatePath("/admin/courses");
}

const createCourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

function fail(path: string, error: unknown): never {
  if (isCourseError(error)) redirect(flashUrl(path, "error", error.message));
  throw error;
}

export async function createCourse(formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);

  const parsed = createCourseSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) redirect(flashUrl(PATH, "error", parsed.error.issues[0]?.message ?? "Invalid input"));

  try {
    await createCourseService(parsed.data);
  } catch (error) {
    fail(PATH, error);
  }

  revalidatePath(PATH);
  redirect(flashUrl(PATH, "success", `${parsed.data.name} was created.`));
}

export async function toggleCourseActive(courseId: string, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const nextActive = formData.get("nextActive") === "true";
  const path = `/admin/courses/${courseId}`;
  await toggleCourseActiveService(courseId, nextActive);
  revalidatePath(PATH);
  revalidatePath(path);
  redirect(flashUrl(path, "success", nextActive ? "Course restored." : "Course archived."));
}

export async function updateCourseDetails(courseId: string, portalArg: CoursePortal, formData: FormData) {
  await requirePermission(PERMISSIONS.COURSES_MANAGE);
  const portal = parseCoursePortal(portalArg);
  const path = settingsPath(portal, courseId, "details");
  if (portal === "admin") await requireActiveCourse(courseId, path);

  const parsed = parseDetailsForm(formData);
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  try {
    await updateCourseDetailsService(courseId, parsed.data);
  } catch (error) {
    fail(path, error);
  }

  revalidateCourse(courseId);
  redirect(flashUrl(path, "success", "Course details saved."));
}

export async function updateCoursePolicy(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  const path = settingsPath(portal, courseId, "policy");
  if (portal === "admin") {
    await requirePermission(PERMISSIONS.COURSES_MANAGE);
    await requireActiveCourse(courseId, path);
  } else {
    await requireCourseConfigure(courseId);
  }

  const parsed = parsePolicyForm(formData);
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid policy"));
  }

  await updateCoursePolicyService(courseId, parsed.data);
  revalidateCourse(courseId);
  redirect(flashUrl(path, "success", "Attendance policy saved."));
}
