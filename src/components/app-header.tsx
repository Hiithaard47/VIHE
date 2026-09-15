import Link from "next/link";

export function AppHeader({ subtitle, right }: { subtitle: string; right?: React.ReactNode }) {
  return (
    <header className="bg-ink print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-heading text-sm font-semibold text-ink">
            V
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Vihe Attendance</div>
            <div className="text-[11px] text-accent">{subtitle}</div>
          </div>
        </Link>
        {right}
      </div>
    </header>
  );
}
