import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function redirectToAdminBatchWorkspace(
  courseId: string,
  suffix: string,
  query?: Record<string, string | undefined>,
) {
  const batch = await prisma.courseBatch.findFirst({
    where: { courseId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (!batch) redirect(`/admin/courses/${courseId}`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  redirect(`/admin/courses/${courseId}/batches/${batch.id}/${suffix}${qs ? `?${qs}` : ""}`);
}
