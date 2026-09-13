export function isTeacherNavActive(pathname: string, href: string) {
  if (href === "/teacher") {
    return (
      pathname === "/teacher" ||
      pathname.startsWith("/teacher/courses/") ||
      pathname.startsWith("/teacher/sessions/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
