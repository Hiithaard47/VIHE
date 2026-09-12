import { prisma } from "@/lib/prisma";

export default async function AdminDashboard() {
  const [teacherCount, courseCount, studentCount, roleCount] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.student.count(),
    prisma.role.count(),
  ]);

  const stats = [
    { label: "Users", value: teacherCount },
    { label: "Courses", value: courseCount },
    { label: "Students", value: studentCount },
    { label: "Roles", value: roleCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-hairline bg-card p-4">
          <p className="font-heading text-2xl font-semibold text-ink">{s.value}</p>
          <p className="text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
