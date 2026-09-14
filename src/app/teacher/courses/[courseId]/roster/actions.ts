"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCourseConfigure } from "@/lib/rbac";
import { flashUrl } from "@/lib/flash";
import { enrollStudentInCourse, unenrollStudentFromCourse } from "@/lib/enrollment";
import { courseHref, parseCoursePortal, type CoursePortal } from "@/lib/course-workspace";

const studentSchema = z.object({ studentId: z.string().min(1, "Pick a student.") });

export async function enrollStudent(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  await requireCourseConfigure(courseId, portal);
  const path = courseHref(portal, courseId, "roster");

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  await enrollStudentInCourse(parsed.data.studentId, courseId);

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student enrolled."));
}

export async function unenrollStudent(courseId: string, portalArg: CoursePortal, formData: FormData) {
  const portal = parseCoursePortal(portalArg);
  await requireCourseConfigure(courseId, portal);
  const path = courseHref(portal, courseId, "roster");

  const parsed = studentSchema.safeParse({ studentId: formData.get("studentId") });
  if (!parsed.success) {
    redirect(flashUrl(path, "error", parsed.error.issues[0]?.message ?? "Invalid input"));
  }

  // Attendance records are left intact: removing someone from the roster
  // must not rewrite the history of sessions they actually attended.
  await unenrollStudentFromCourse(parsed.data.studentId, courseId);

  revalidatePath(path);
  redirect(flashUrl(path, "success", "Student removed from this course."));
}
