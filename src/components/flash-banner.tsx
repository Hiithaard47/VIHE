"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function FlashBannerInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const flash = searchParams.get("flash");
  const isError = searchParams.get("kind") === "error";

  function dismiss() {
    const next = new URLSearchParams(query);
    next.delete("flash");
    next.delete("kind");
    const cleaned = next.toString();
    router.replace(cleaned ? `${pathname}?${cleaned}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(dismiss, 4000);
    return () => clearTimeout(timeout);
  }, [flash, pathname, query, router]);

  if (!flash) return null;

  return (
    <div
      role="status"
      className={
        isError
          ? "flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 print:hidden"
          : "flex items-start justify-between gap-3 rounded-md border border-hairline bg-card px-3 py-2 text-sm text-ink print:hidden"
      }
    >
      <span>
        {!isError && <span className="font-medium text-accent-dark">Saved. </span>}
        {flash}
      </span>
      <button onClick={dismiss} aria-label="Dismiss" className="text-xs text-muted hover:text-ink">
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
