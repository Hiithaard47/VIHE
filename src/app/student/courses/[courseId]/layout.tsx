import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSubTabs } from "@/components/admin-sub-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { findStudentCourseEnrollment } from "@/lib/enrollment";
import { requireStudent } from "@/lib/rbac";

export default async function StudentCourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await requireStudent();
  const enrollment = await findStudentCourseEnrollment(session.user.id, courseId);
  if (!enrollment) notFound();

  const { course, name: batchName } = enrollment.batch;

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <div>
        <Link href="/student" className="text-sm text-muted">
          &larr; My courses
        </Link>
        <h1 className="font-heading text-lg font-semibold text-ink">{course.name}</h1>
        <p className="text-sm text-muted">
          {course.code} · {batchName}
          {!course.isActive && " · Completed"}
        </p>
        {course.description && <p className="mt-2 text-sm text-ink">{course.description}</p>}
      </div>
      <AdminSubTabs
        base={`/student/courses/${courseId}`}
        tabs={[
          { slug: "", label: "Sessions" },
          { slug: "documents", label: "Documents" },
          { slug: "assignments", label: "Assignments" },
        ]}
      />
      {children}
    </div>
  );
}
