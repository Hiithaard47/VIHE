import { AdminStatusTabs } from "@/components/admin-status-tabs";
import { courseListHref, type CourseListTab } from "@/modules/courses/service/course-list";

export function AdminCourseStatusTabs({ tab }: { tab: CourseListTab }) {
  return <AdminStatusTabs tab={tab} hrefForTab={courseListHref} />;
}
