import Link from "next/link";

export function AdminRecordChrome({
  backHref,
  backLabel,
  title,
  subtitle,
  isActive,
  archivedNote,
  action,
  tabs,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  archivedNote: string;
  action?: React.ReactNode;
  tabs: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={backHref} className="text-sm text-muted hover:text-ink">
            &larr; {backLabel}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg font-semibold text-ink">{title}</h1>
            {!isActive && <span className="text-xs text-muted">Archived</span>}
          </div>
          <p className="text-sm text-muted">{subtitle}</p>
          {!isActive && <p className="mt-2 text-sm text-muted">{archivedNote}</p>}
        </div>
        {action}
      </div>
      {tabs}
      {children}
    </>
  );
}
