"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function FlashBannerInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flash = searchParams.get("flash");
  const isError = searchParams.get("kind") === "error";

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => router.replace(pathname, { scroll: false }), 4000);
    return () => clearTimeout(timeout);
  }, [flash, pathname, router]);

  if (!flash) return null;

  return (
    <div
      role="status"
      className={
        isError
          ? "flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          : "flex items-start justify-between gap-3 rounded-md border border-hairline bg-card px-3 py-2 text-sm text-ink"
      }
    >
      <span>
        {!isError && <span className="font-medium text-accent-dark">Saved. </span>}
        {flash}
      </span>
      <button
        onClick={() => router.replace(pathname, { scroll: false })}
        aria-label="Dismiss"
        className="text-xs text-muted hover:text-ink"
      >
        Dismiss
      </button>
    </div>
  );
}

export function FlashBanner() {
  return (
    <Suspense fallback={null}>
      <FlashBannerInner />
    </Suspense>
  );
}
