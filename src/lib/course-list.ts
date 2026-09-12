import { adminListHref, type AdminListTab } from "@/lib/admin-list";

export const COURSE_PAGE_SIZE = 20;
export type CourseListTab = AdminListTab;

export { parseAdminListPage as parseCourseListPage, parseAdminListTab as parseCourseListTab } from "@/lib/admin-list";

export function courseListHref(tab: CourseListTab, page = 1, q = ""): string {
  return adminListHref("/admin/courses", tab, page, q);
}
