"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveCourse, requireCourseConfigure, requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { flashUrl, isUniqueConstraintError } from "@/lib/flash";
import { parseDetailsForm } from "@/lib/course-details";
import { parsePolicyForm } from "@/lib/policy";
import { parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";

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
    await prisma.course.update({
      where: { id: courseId },
      data: { ...parsed.data, description: parsed.data.description.trim() || null },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      redirect(flashUrl(path, "error", "That course code is already in use."));
    }
    throw err;
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

  await prisma.course.update({ where: { id: courseId }, data: parsed.data });
  revalidateCourse(courseId);
  redirect(flashUrl(path, "success", "Attendance policy saved."));
}
