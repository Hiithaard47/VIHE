import { notFound } from "next/navigation";
import { AdminRecordChrome } from "@/components/admin-record-chrome";
import { AdminSubTabs } from "@/components/admin-sub-tabs";
import { FlashBanner } from "@/components/flash-banner";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac";
import { toggleStudentActive } from "@/modules/students/actions";

export default async function AdminStudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  await requireAnyPermission([PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.COURSES_MANAGE]);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, rollNumber: true, isActive: true },
  });
  if (!student) notFound();

  return (
    <div className="flex flex-col gap-5">
      <FlashBanner />
      <AdminRecordChrome
        backHref="/admin/students"
        backLabel="Students"
        title={student.name}
        subtitle={student.rollNumber}
        isActive={student.isActive}
        archivedNote="This student is archived. Restore to make changes."
        action={
          <form action={toggleStudentActive.bind(null, student.id)}>
            <input type="hidden" name="nextActive" value={(!student.isActive).toString()} />
            <button type="submit" className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              {student.isActive ? "Archive" : "Restore"}
            </button>
          </form>
        }
        tabs={
          <AdminSubTabs
            base={`/admin/students/${student.id}`}
            tabs={[
              { slug: "", label: "Courses" },
              { slug: "details", label: "Details" },
              { slug: "attendance", label: "Attendance" },
            ]}
          />
        }
      >
        {children}
      </AdminRecordChrome>
    </div>
  );
}
