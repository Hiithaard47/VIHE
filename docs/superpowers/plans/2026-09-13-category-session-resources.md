# Category Session Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin turn session file upload/list on or off per `SessionCategory`, so Class keeps the Resources block and Mangla Aarti can hide it.

**Architecture:** Add `SessionCategory.allowsResources` (default true). Admin add/edit/list already live at `/admin/session-categories`. The session page reads the flag on the session’s category and omits `<SessionResources />` when it is false. `uploadSessionResource` uses the same helper so a crafted POST cannot upload. Teacher Uploads and student Documents are not filtered.

**Tech Stack:** Next.js 16.3.1 (App Router, server actions), Prisma 6.19.3 + Postgres, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-13-category-session-resources-design.md`

## Global Constraints

- `AGENTS.md`: this is Next.js 16. `params` / `searchParams` are `Promise`s. Read `node_modules/next/dist/docs/` before changing routing or server actions.
- Theme tokens only: `ink`, `accent`, `accent-dark`, `canvas`, `card`, `muted`, `hairline`, `input`.
- Server actions report via `flashUrl` + `<FlashBanner />`. Every action starts with a permission / batch guard.
- Checkbox fields follow `src/lib/policy.ts`: present in `FormData` means true (`formData.get("allowsResources") !== null`).
- Playwright `workers: 1`. Every unique column uses `unique()` from `e2e/helpers.ts`.
- Commits must be SSH-signed. Do not pass `--no-gpg-sign`. Do not commit `.env`.
- If `npm run test:e2e` cannot bind `:3001` because `:3000` holds the `.next` lock, stop the `:3000` `next dev` process, run e2e, and tell the user to restart `npm run dev`.
- Exact copy: checkbox **Allow session files**; hint **Show upload and file list on sessions of this category.**; list values **Files** / **No files**; upload reject flash **This category does not allow session files.**

## File map

- `src/lib/session-categories.ts` — `parseAllowsResources`, `sessionResourceUploadError`
- `src/lib/session-categories.test.ts` — unit tests for those helpers
- `prisma/schema.prisma` — `allowsResources Boolean @default(true)`
- `prisma/migrations/20260913020000_session_category_allows_resources/migration.sql`
- `src/app/admin/session-categories/actions.ts` — persist the flag
- `src/components/add-session-category-dialog.tsx` — add checkbox (default on)
- `src/app/admin/session-categories/page.tsx` — Files column
- `src/app/admin/session-categories/[categoryId]/page.tsx` — edit checkbox
- `src/components/course-workspace/session-detail.tsx` — hide Resources when off
- `src/app/teacher/sessions/[sessionId]/actions.ts` — reject upload when off
- `e2e/admin-session-categories.spec.ts` — hide Resources on a no-files category; Class still shows it

Do not change `uploads.tsx`, student Documents, or `deleteSessionResource`.

---

### Task 1: Helper + schema

**Files:**
- Modify: `src/lib/session-categories.ts`
- Modify: `src/lib/session-categories.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260913020000_session_category_allows_resources/migration.sql`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `parseAllowsResources(formData: FormData): boolean`
  - `sessionResourceUploadError(allowsResources: boolean): string | null` — `null` when allowed; `"This category does not allow session files."` when not
  - Prisma field `SessionCategory.allowsResources: boolean` default `true`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/session-categories.test.ts` (keep existing imports and suites; add the new import names):

```ts
import {
  DEFAULT_SESSION_CATEGORY_NAME,
  groupSessionsByCategory,
  parseAllowsResources,
  resolveCategoryTab,
  sessionCategoryTabs,
  sessionResourceUploadError,
} from "@/lib/session-categories";

describe("parseAllowsResources", () => {
  it("is true when the checkbox is present, false when absent", () => {
    const on = new FormData();
    on.set("allowsResources", "on");
    expect(parseAllowsResources(on)).toBe(true);
    expect(parseAllowsResources(new FormData())).toBe(false);
  });
});

describe("sessionResourceUploadError", () => {
  it("refuses upload when the category does not allow session files", () => {
    expect(sessionResourceUploadError(true)).toBeNull();
    expect(sessionResourceUploadError(false)).toBe("This category does not allow session files.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/session-categories.test.ts`

Expected: FAIL — `parseAllowsResources` / `sessionResourceUploadError` are not functions.

- [ ] **Step 3: Implement the helpers**

Add to `src/lib/session-categories.ts`:

```ts
export function parseAllowsResources(formData: FormData): boolean {
  return formData.get("allowsResources") !== null;
}

export function sessionResourceUploadError(allowsResources: boolean): string | null {
  return allowsResources ? null : "This category does not allow session files.";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/session-categories.test.ts`

Expected: PASS (existing suites + the two new ones).

- [ ] **Step 5: Add the Prisma field and migration**

In `prisma/schema.prisma`, on `SessionCategory`, after `isSystem`:

```prisma
  allowsResources       Boolean  @default(true)
```

Create `prisma/migrations/20260913020000_session_category_allows_resources/migration.sql`:

```sql
ALTER TABLE "session_categories" ADD COLUMN "allowsResources" BOOLEAN NOT NULL DEFAULT true;
```

Run: `npx prisma generate`

Expected: client includes `allowsResources`. Existing rows stay `true` via the default.

Do not change `prisma/seed.ts` — the column default covers Class.

- [ ] **Step 6: Commit**

```bash
git add src/lib/session-categories.ts src/lib/session-categories.test.ts prisma/schema.prisma prisma/migrations/20260913020000_session_category_allows_resources
git commit -m "$(cat <<'EOF'
feat: add session category allowsResources flag

Admin will toggle session files per category. Default
on so Class and existing rows keep today's upload UI.
EOF
)"
```

---

### Task 2: Admin add, edit, and list

**Files:**
- Modify: `src/app/admin/session-categories/actions.ts`
- Modify: `src/components/add-session-category-dialog.tsx`
- Modify: `src/app/admin/session-categories/page.tsx`
- Modify: `src/app/admin/session-categories/[categoryId]/page.tsx`

**Interfaces:**
- Consumes: `parseAllowsResources(formData: FormData): boolean`
- Produces: create/update persist `allowsResources`. Add dialog checkbox default checked. Edit checkbox reflects stored value. List column **Files** / **No files**.

- [ ] **Step 1: Persist the flag in category actions**

In `src/app/admin/session-categories/actions.ts`:

1. Change the import to:

```ts
import { parseAllowsResources, parseMinAttendancePercent } from "@/lib/session-categories";
```

2. Change `parseCategoryForm`’s return to include the flag:

```ts
  return {
    name: parsed.data.name,
    minAttendancePercent,
    allowsResources: parseAllowsResources(formData),
  };
```

`createSessionCategory` already does `prisma.sessionCategory.create({ data })` — `data` now includes `allowsResources`.

`updateSessionCategory` already writes `name` and `minAttendancePercent`. Add `allowsResources` to that `data` object:

```ts
    await prisma.sessionCategory.update({
      where: { id: categoryId },
      data: {
        name: category.isSystem ? undefined : data.name,
        minAttendancePercent: data.minAttendancePercent,
        allowsResources: data.allowsResources,
      },
    });
```

Class (`isSystem`) may change the flag; only the name stays read-only.

- [ ] **Step 2: Add the checkbox to the create dialog**

In `src/components/add-session-category-dialog.tsx`, after the min-% label and before the Create button:

```tsx
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="allowsResources" defaultChecked className="mt-1" />
            <span>
              Allow session files
              <span className="block text-xs text-muted">
                Show upload and file list on sessions of this category.
              </span>
            </span>
          </label>
```

Default checked so new categories stay on unless Admin unchecks.

- [ ] **Step 3: Show Files / No files on the list**

In `src/app/admin/session-categories/page.tsx`:

1. Add a header cell after **Min %**:

```tsx
                <th className="px-4 py-2 font-medium">Files</th>
```

2. Add a body cell after `minAttendancePercent`:

```tsx
                  <td className="px-4 py-3">{category.allowsResources ? "Files" : "No files"}</td>
```

3. Change empty-state `colSpan={4}` to `colSpan={5}`.

- [ ] **Step 4: Edit checkbox on the category detail page**

In `src/app/admin/session-categories/[categoryId]/page.tsx`:

1. Add `allowsResources: true` to the `select`.

2. After the min-% label, inside the same fieldset:

```tsx
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="allowsResources"
                  defaultChecked={category.allowsResources}
                  className="mt-1"
                />
                <span>
                  Allow session files
                  <span className="block text-xs text-muted">
                    Show upload and file list on sessions of this category.
                  </span>
                </span>
              </label>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/session-categories src/components/add-session-category-dialog.tsx
git commit -m "$(cat <<'EOF'
feat: let admin toggle session files per category

Add, edit, and list expose allowsResources so temple
programs can hide the session Resources block.
EOF
)"
```

---

### Task 3: Hide session Resources and reject uploads

**Files:**
- Modify: `src/components/course-workspace/session-detail.tsx`
- Modify: `src/app/teacher/sessions/[sessionId]/actions.ts`
- Modify: `e2e/admin-session-categories.spec.ts`

**Interfaces:**
- Consumes: `sessionResourceUploadError(allowsResources: boolean): string | null`; `category.allowsResources`
- Produces: session page omits the Resources heading/upload/list when the flag is false; `uploadSessionResource` redirects with flash `error` / `This category does not allow session files.`; e2e covers both a no-files category and Class.

- [ ] **Step 1: Write the failing e2e**

Append to `e2e/admin-session-categories.spec.ts` (same imports as the file already uses):

```ts
  test("hides session resources when the category disallows files", async ({ page }) => {
    const course = await createCourse(`No Files Course ${unique("c")}`, unique("NFL").toUpperCase());
    await loginAsAdmin(page);
    await page.goto("/admin/session-categories");

    const name = `Mangala ${unique("m")}`;
    await page.getByRole("button", { name: "Add category" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("checkbox", { name: /Allow session files/ }).uncheck();
    expect(await waitForFlashAfter(page, () => dialog.getByRole("button", { name: "Create category" }).click())).toBe(
      "success",
    );
    await expect(page.locator("tr", { hasText: name }).getByText("No files")).toBeVisible();
    await expect(page.locator("tr", { hasText: "Class" }).getByText("Files")).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/sessions`);
    await page.locator('input[type="date"]').fill("2026-03-15");
    await page.locator('input[name="name"]').fill("Morning aarti");
    await page.locator('select[name="categoryId"]').selectOption({ label: name });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await page.locator('a[href*="/admin/sessions/"]', { hasText: "Morning aarti" }).click();
    await expect(page.getByRole("heading", { name: "Resources" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save attendance" })).toBeVisible();

    await page.goto(`/admin/courses/${course.id}/sessions`);
    await page.locator('input[type="date"]').fill("2026-03-16");
    await page.locator('input[name="name"]').fill("Chapter 1");
    await page.locator('select[name="categoryId"]').selectOption({ label: "Class" });
    expect(await waitForFlashAfter(page, () => page.getByRole("button", { name: "Create session" }).click())).toBe(
      "success",
    );
    await page.locator('a[href*="/admin/sessions/"]', { hasText: "Chapter 1" }).click();
    await expect(page.getByRole("heading", { name: "Resources" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
  });
```

`getByLabel("Name")` already matches the add-dialog name field in the existing create test.

- [ ] **Step 2: Run the e2e to verify it fails**

Run: `npm run test:e2e -- e2e/admin-session-categories.spec.ts`

Expected: the new test FAIL — checkbox missing and/or Resources still visible on Mangala (if Task 2 landed, checkbox exists but session page still shows Resources).

- [ ] **Step 3: Hide the Resources block**

In `src/components/course-workspace/session-detail.tsx`, change the category select from `{ name: true }` to `{ name: true, allowsResources: true }`.

Replace the unconditional `<SessionResources … />` with:

```tsx
      {classSession.category.allowsResources && (
        <SessionResources sessionId={sessionId} resources={classSession.resources} canManage={canManage} portal={portal} />
      )}
```

Attendance markup below it stays as-is.

- [ ] **Step 4: Reject uploads in the action**

In `src/app/teacher/sessions/[sessionId]/actions.ts`:

1. Add import:

```ts
import { sessionResourceUploadError } from "@/lib/session-categories";
```

2. In `uploadSessionResource`, change the session fetch and insert the guard after `requireBatchAccess` and before the storage check:

```ts
  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { batchId: true, category: { select: { allowsResources: true } } },
  });
  const session = await requireBatchAccess(classSession.batchId, portal);

  const blocked = sessionResourceUploadError(classSession.category.allowsResources);
  if (blocked) redirect(flashUrl(path, "error", blocked));
```

Do not change `deleteSessionResource`.

- [ ] **Step 5: Run unit + e2e**

Run:

```bash
npx vitest run src/lib/session-categories.test.ts
npm run test:e2e -- e2e/admin-session-categories.spec.ts
```

Expected: PASS. Existing category tests still pass (new checkbox defaults checked).

- [ ] **Step 6: Commit**

```bash
git add src/components/course-workspace/session-detail.tsx src/app/teacher/sessions/[sessionId]/actions.ts e2e/admin-session-categories.spec.ts
git commit -m "$(cat <<'EOF'
feat: hide session files when category disallows them

Session page omits Resources and upload is rejected
when allowsResources is false.
EOF
)"
```

---

## Self-review

| Spec item | Task |
| --- | --- |
| `allowsResources` default true; existing rows stay on | Task 1 migration `DEFAULT true` |
| New categories default on; Admin unchecks | Task 2 `defaultChecked` |
| Flag off does not delete files | No delete path added |
| Add + edit checkbox + hint copy | Task 2 |
| List Files / No files | Task 2 |
| Session page hide heading/upload/list | Task 3 |
| Attendance unchanged | Task 3 leaves `AttendanceForm` |
| Uploads / Documents unfiltered | Not modified |
| Upload action rejects | Task 3 + helper from Task 1 |
| Delete from Uploads still works | `deleteSessionResource` untouched |
| Unit helper refuse | Task 1 |
| e2e no-files vs Class | Task 3 |
| Out of scope items | Not in any task |
