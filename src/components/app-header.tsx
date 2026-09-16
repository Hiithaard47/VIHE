import Link from "next/link";

export function AppHeader({ subtitle, right }: { subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="bg-ink print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <img
            src="/vihe-header.jpg"
            alt=""
            width={1004}
            height={162}
            fetchPriority="high"
            className="h-10 w-32 shrink-0 object-cover object-left sm:h-16 sm:w-auto"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">Vihe Attendance</span>
            {subtitle ? <span className="block truncate text-[11px] text-accent">{subtitle}</span> : null}
          </span>
        </Link>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
