import { AdminStatusTabs } from "@/components/admin-status-tabs";
import { courseListHref, type CourseListTab } from "@/lib/course-list";

export function AdminCourseStatusTabs({ tab }: { tab: CourseListTab }) {
  return <AdminStatusTabs tab={tab} hrefForTab={courseListHref} />;
}
