import Link from "next/link";
import { AddStudentDialog } from "@/components/add-student-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { FlashBanner } from "@/components/flash-banner";
import { ListPagination } from "@/components/list-pagination";
import { ListSearch } from "@/components/list-search";
import { ADMIN_PAGE_SIZE, containsInsensitive, parseAdminListPage, parseAdminListSearch } from "@/lib/admin-list";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatDisplayDate } from "@/lib/time";
import { approveApplication, rejectApplication } from "./actions";
import { importStudents } from "@/app/admin/bulk-import-actions";

const PATH = "/admin/students";
const MODE_LABELS = { ONLINE: "Online", HYBRID: "Hybrid", ON_SITE: "On-site" } as const;
const LANGUAGE_LABELS = { ENGLISH: "English", HINDI: "Hindi" } as const;

type StudentListTab = "active" | "archived" | "applications";

function parseStudentListTab(value: string | undefined): StudentListTab {
  if (value === "archived" || value === "applications") return value;
  return "active";
}

function studentListHref(tab: StudentListTab, page = 1, q = "") {
  const params = new URLSearchParams();
  if (tab !== "active") params.set("tab", tab);
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

const TABS: { slug: StudentListTab; label: string }[] = [
  { slug: "active", label: "Active" },
  { slug: "archived", label: "Archived" },
  { slug: "applications", label: "Applications" },
];

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  await requirePermission(PERMISSIONS.STUDENTS_MANAGE);
  const { tab: rawTab, page: rawPage, q: rawQ } = await searchParams;
  const tab = parseStudentListTab(rawTab);
  const q = parseAdminListSearch(rawQ);
  const isApplications = tab === "applications";
  const isActive = tab === "active";

  if (isApplications) {
    const applicationWhere = q
      ? { status: "PENDING" as const, ...containsInsensitive(q, ["name", "email", "phone"]) }
      : { status: "PENDING" as const };
    const total = await prisma.studentApplication.count({ where: applicationWhere });
    const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
    const page = parseAdminListPage(rawPage, totalPages);
    const applications = await prisma.studentApplication.findMany({
      where: applicationWhere,
      include: { desiredCourse: true },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    });

    return (
      <div className="flex flex-col gap-8">
        <FlashBanner />
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Students</h2>
          </div>
          <StudentTabs tab={tab} />
          <ListSearch action={PATH} tab={tab} q={q} placeholder="Search by name, email, or mobile" />
          <ApplicationCards
            applications={applications}
            empty={q ? "No matching applications." : "No pending applications."}
          />
          <ListPagination
            page={page}
            totalPages={totalPages}
            hrefForPage={(nextPage) => studentListHref(tab, nextPage, q)}
          />
        </section>
      </div>
    );
  }

  const where = {
    isActive,
    ...(q ? containsInsensitive(q, ["name", "rollNumber", "email", "phone"]) : {}),
  };

  const [total, courses] = await Promise.all([
    prisma.student.count({ where }),
    prisma.course.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = parseAdminListPage(rawPage, totalPages);
  const students = await prisma.student.findMany({
    where,
    include: { enrollments: { include: { course: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-8">
      <FlashBanner />
      <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Students</h2>
            {isActive && (
              <div className="flex items-center gap-2">
                <BulkImportDialog
                  title="Import students"
                  action={importStudents}
                  hint="CSV columns: name, rollNumber, email (optional), phone (optional), password (optional), courseCode (optional)."
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted">Default portal password (optional)</span>
                    <input
                      name="defaultPassword"
                      type="password"
                      minLength={8}
                      className="rounded-md border border-hairline bg-input px-3 py-2 text-ink"
                    />
                  </label>
                </BulkImportDialog>
                <AddStudentDialog courses={courses} />
              </div>
            )}
          </div>
        <StudentTabs tab={tab} />
        <ListSearch action={PATH} tab={tab} q={q} placeholder="Search by name, roll number, email, or mobile" />
        <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Courses</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-hairline text-ink last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/students/${student.id}`} className="font-heading font-medium hover:text-accent-dark">
                      {student.name}
                    </Link>
                    <p className="text-xs text-muted">{student.rollNumber}</p>
                    {(student.email || student.phone) && (
                      <p className="text-xs text-muted">{[student.email, student.phone].filter(Boolean).join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {student.enrollments.length > 0 ? (
                      student.enrollments.map(({ course }) => (
                        <p key={course.id}>
                          {course.name}
                          {!course.isActive && <span className="text-muted"> (completed)</span>}
                        </p>
                      ))
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm text-muted">
                    {q ? "No matching students." : isActive ? "No active students yet." : "No archived students."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          totalPages={totalPages}
          hrefForPage={(nextPage) => studentListHref(tab, nextPage, q)}
        />
      </section>
    </div>
  );
}

function StudentTabs({ tab }: { tab: StudentListTab }) {
  return (
    <nav className="-mb-px flex gap-1 border-b border-hairline">
      {TABS.map((item) => {
        const active = item.slug === tab;
        return (
          <Link
            key={item.slug}
            href={studentListHref(item.slug)}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ApplicationCards({
  applications,
  empty,
}: {
  applications: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    country: string | null;
    dateOfBirth: Date | null;
    desiredCourse: { name: string } | null;
    preferredMode: keyof typeof MODE_LABELS | null;
    preferredLanguage: keyof typeof LANGUAGE_LABELS | null;
    priorExperience: string | null;
    message: string | null;
  }>;
  empty: string;
}) {
  if (applications.length === 0) {
    return <p className="rounded-lg border border-hairline bg-card px-4 py-3 text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {applications.map((application) => (
        <div key={application.id} className="rounded-lg border border-hairline bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-lg">
              <p className="font-heading font-medium text-ink">{application.name}</p>
              <p className="text-xs text-muted">{application.email}</p>
              {application.phone && <p className="text-xs text-muted">{application.phone}</p>}
              {(application.city || application.country) && (
                <p className="text-xs text-muted">
                  {[application.city, application.country].filter(Boolean).join(", ")}
                </p>
              )}
              {application.dateOfBirth && (
                <p className="text-xs text-muted">Born {formatDisplayDate(application.dateOfBirth)}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {application.desiredCourse && (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-accent-dark">
                    {application.desiredCourse.name}
                  </span>
                )}
                {application.preferredMode && (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                    {MODE_LABELS[application.preferredMode]}
                  </span>
                )}
                {application.preferredLanguage && (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">
                    {LANGUAGE_LABELS[application.preferredLanguage]}
                  </span>
                )}
              </div>
              {application.priorExperience && (
                <p className="mt-2 text-sm text-ink">
                  <span className="text-xs font-medium text-muted">Prior experience: </span>
                  {application.priorExperience}
                </p>
              )}
              {application.message && <p className="mt-2 text-sm text-ink">{application.message}</p>}
            </div>
            <div className="flex items-center gap-3">
              <form action={approveApplication.bind(null, application.id)} className="flex items-center gap-2">
                <input
                  name="rollNumber"
                  placeholder="Assign roll no."
                  required
                  className="w-32 rounded-md border border-hairline bg-input px-2 py-1.5 text-xs text-ink placeholder:text-muted"
                />
                <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                  Approve
                </button>
              </form>
              <form action={rejectApplication.bind(null, application.id)}>
                <button type="submit" className="text-xs text-muted underline hover:text-accent-dark">
                  Reject
                </button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
