export const DEFAULT_SESSION_CATEGORY_NAME = "Class";
export const DEFAULT_SESSION_CATEGORY_MIN_PERCENT = 75;

export function groupSessionsByCategory<T extends { category: { id: string; name: string } }>(
  sessions: T[],
): { id: string; name: string; sessions: T[] }[] {
  const groups = new Map<string, { id: string; name: string; sessions: T[] }>();
  for (const session of sessions) {
    const existing = groups.get(session.category.id);
    if (existing) existing.sessions.push(session);
    else groups.set(session.category.id, { ...session.category, sessions: [session] });
  }
  return [...groups.values()].sort((a, b) => {
    if (a.name === DEFAULT_SESSION_CATEGORY_NAME && b.name !== DEFAULT_SESSION_CATEGORY_NAME) return -1;
    if (b.name === DEFAULT_SESSION_CATEGORY_NAME && a.name !== DEFAULT_SESSION_CATEGORY_NAME) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function sessionCategoryTabs<T extends { id: string; name: string }>(
  groups: T[],
): T[] {
  return groups;
}

export function resolveCategoryTab<T extends { id: string; name: string }>(
  tabs: T[],
  requestedId?: string | null,
): T | undefined {
  return tabs.find((tab) => tab.id === requestedId) ?? tabs.find((tab) => tab.name === DEFAULT_SESSION_CATEGORY_NAME) ?? tabs[0];
}

export function parseMinAttendancePercent(raw: FormDataEntryValue | null): number | null | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100) return undefined;
  return n;
}

export function parseAllowsResources(formData: FormData): boolean {
  return formData.get("allowsResources") !== null;
}

export function sessionResourceUploadError(allowsResources: boolean): string | null {
  return allowsResources ? null : "This category does not allow session files.";
}
