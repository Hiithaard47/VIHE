export const ADMIN_PAGE_SIZE = 20;

export type AdminListTab = "active" | "archived";

export function parseAdminListTab(value: string | undefined): AdminListTab {
  return value === "archived" ? "archived" : "active";
}

export function parseAdminListPage(value: string | undefined, totalPages: number): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, totalPages));
}

export function parseAdminListSearch(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function adminListHref(basePath: string, tab: AdminListTab, page = 1, q = ""): string {
  const params = new URLSearchParams();
  if (tab === "archived") params.set("tab", "archived");
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
