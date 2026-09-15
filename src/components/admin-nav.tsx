"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, isAdminNavActive } from "@/lib/admin-nav";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-44 shrink-0 flex-col gap-1 text-sm print:hidden">
      {ADMIN_NAV.map((item) => {
        const active = isAdminNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 ${
              active
                ? "bg-card font-semibold text-accent-dark"
                : "text-ink hover:bg-card hover:text-accent-dark"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
