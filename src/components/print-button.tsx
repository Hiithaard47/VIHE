"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas print:hidden"
    >
      {label}
    </button>
  );
}
