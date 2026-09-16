"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

export function UserMenu({ name, accountHref }: { name: string; accountHref: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-28 items-center gap-1 text-sm text-white hover:text-accent sm:max-w-48"
      >
        <span className="truncate">{name}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
          <path fill="currentColor" d="M5.8 7.4a1 1 0 0 1 1.4 0L10 10.2l2.8-2.8a1 1 0 1 1 1.4 1.4l-3.5 3.5a1 1 0 0 1-1.4 0L5.8 8.8a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-20 mt-1 min-w-40 rounded-md border border-hairline bg-card py-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href={accountHref}
            className="block px-3 py-2 text-sm text-ink hover:bg-canvas"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
