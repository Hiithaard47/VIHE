"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, ADMIN_SETTINGS_NAV, isAdminNavActive, isAdminSettingsActive } from "@/lib/admin-nav";

const ICONS: Record<string, string> = {
  "/admin": "M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z",
  "/admin/teachers":
    "M10 9.5A3.25 3.25 0 1 0 10 3a3.25 3.25 0 0 0 0 6.5ZM4.75 17a5.25 5.25 0 0 1 10.5 0 1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1Z",
  "/admin/courses":
    "M4.5 3A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4.5Zm.5 2h10v9.5H5V5Z",
  "/admin/students":
    "M7.25 8.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm7 1.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM2.4 16.1A5.1 5.1 0 0 1 12.3 16c.08.4-.14.8-.5 1A8.6 8.6 0 0 1 7.25 18 8.6 8.6 0 0 1 2.7 17c-.35-.2-.57-.6-.5-1a5 5 0 0 1 .2-.9Zm11.85.15h-.1a6.4 6.4 0 0 0-1.35-3.2 3.9 3.9 0 0 1 5.05 2.25c.16.4 0 .8-.36 1a6.4 6.4 0 0 1-3.24.95Z",
  "/admin/session-categories":
    "M3 5.5A2.5 2.5 0 0 1 5.5 3h4.17c.66 0 1.3.26 1.77.73l5.83 5.83a2.5 2.5 0 0 1 0 3.54l-4.13 4.13a2.5 2.5 0 0 1-3.54 0L3.73 11.4A2.5 2.5 0 0 1 3 9.63V5.5Zm3.25.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z",
  "/admin/roles":
    "M10 2 3.75 4.6v5.1c0 3.9 2.6 7.5 6.25 8.7 3.65-1.2 6.25-4.8 6.25-8.7V4.6L10 2Zm-.1 11.3-2.9-2.9 1.4-1.4 1.5 1.5 3.4-3.4 1.4 1.4-4.8 4.8Z",
};

export function AdminNav() {
  const pathname = usePathname();
  const settingsActive = isAdminSettingsActive(pathname);
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  const [openedForActive, setOpenedForActive] = useState(settingsActive);
  const settingsId = useId();

  if (settingsActive && !openedForActive) {
    setOpenedForActive(true);
    setSettingsOpen(true);
  } else if (!settingsActive && openedForActive) {
    setOpenedForActive(false);
  }

  return (
    <nav aria-label="Admin" className="flex w-52 shrink-0 flex-col gap-1 text-sm print:hidden">
      {ADMIN_NAV.map((item) => (
        <AdminNavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
      ))}
      <div className="mt-3 flex flex-col gap-1">
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          onClick={() => setSettingsOpen((value) => !value)}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide ${
            settingsActive ? "text-accent-dark" : "text-muted hover:bg-card hover:text-ink"
          }`}
        >
          <span className="flex-1">Settings</span>
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M5.8 7.4a1 1 0 0 1 1.4 0L10 10.2l2.8-2.8a1 1 0 1 1 1.4 1.4l-3.5 3.5a1 1 0 0 1-1.4 0L5.8 8.8a1 1 0 0 1 0-1.4Z"
            />
          </svg>
        </button>
        {settingsOpen ? (
          <div id={settingsId} className="flex flex-col gap-1">
            {ADMIN_SETTINGS_NAV.map((item) => (
              <AdminNavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function AdminNavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = isAdminNavActive(pathname, href);
  const icon = ICONS[href];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md px-3 py-2 ${
        active ? "bg-card font-semibold text-accent-dark" : "text-ink hover:bg-card hover:text-accent-dark"
      }`}
    >
      {icon ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
          <path fill="currentColor" d={icon} />
        </svg>
      ) : null}
      <span className="min-w-0 leading-snug">{label}</span>
    </Link>
  );
}
