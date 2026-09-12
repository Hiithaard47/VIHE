import Link from "next/link";
import { type AdminListTab } from "@/lib/admin-list";

const TABS: { slug: AdminListTab; label: string }[] = [
  { slug: "active", label: "Active" },
  { slug: "archived", label: "Archived" },
];

export function AdminStatusTabs({
  tab,
  hrefForTab,
}: {
  tab: AdminListTab;
  hrefForTab: (tab: AdminListTab) => string;
}) {
  return (
    <nav className="-mb-px flex gap-1 border-b border-hairline">
      {TABS.map((item) => {
        const active = item.slug === tab;
        return (
          <Link
            key={item.slug}
            href={hrefForTab(item.slug)}
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
