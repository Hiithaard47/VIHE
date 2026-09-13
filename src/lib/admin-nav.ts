export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/session-categories", label: "Session categories" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/roles", label: "Roles & permissions" },
] as const;

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/courses" && pathname.startsWith("/admin/sessions/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
