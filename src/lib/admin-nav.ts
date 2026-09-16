export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/students", label: "Students" },
] as const;

export const ADMIN_SETTINGS_NAV = [
  { href: "/admin/session-categories", label: "Session categories" },
  { href: "/admin/roles", label: "Roles & permissions" },
] as const;

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/courses" && pathname.startsWith("/admin/sessions/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAdminSettingsActive(pathname: string) {
  return ADMIN_SETTINGS_NAV.some((item) => isAdminNavActive(pathname, item.href));
}
