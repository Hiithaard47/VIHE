import { redirect } from "next/navigation";

export default async function AdminBatchPlaceholder({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; batchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  redirect(`/admin/courses/${courseId}${query.size ? `?${query.toString()}` : ""}`);
}
