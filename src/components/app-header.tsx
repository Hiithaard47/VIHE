import Link from "next/link";

export function AppHeader({
  title = "Vihe",
  subtitle,
  right,
}: {
  title?: string | null;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const brandOnly = !title && !subtitle && !right;

  return (
    <header className="bg-ink print:hidden">
      <div
        className={
          brandOnly
            ? "flex w-full items-center justify-center px-0 py-0"
            : `mx-auto flex max-w-5xl items-center gap-2 px-0 py-0 sm:gap-3 sm:px-6 sm:py-2 ${
                right ? "justify-between" : "justify-center"
              }`
        }
      >
        <Link
          href="/"
          aria-label={title ?? "Home"}
          className={`flex min-w-0 items-center gap-3 ${brandOnly || right ? "min-w-0 flex-1" : ""} ${brandOnly ? "w-full" : ""}`}
        >
          <img
            src="/vihe-header.jpg"
            alt=""
            width={1004}
            height={162}
            fetchPriority="high"
            className={
              brandOnly
                ? "h-16 w-full object-cover object-center sm:h-20"
                : "h-12 w-full min-w-0 object-cover object-left sm:h-16 sm:w-auto sm:shrink-0"
            }
          />
          {title || subtitle ? (
            <span className="hidden min-w-0 sm:block">
              {title ? <span className="truncate text-sm font-semibold text-white">{title}</span> : null}
              {subtitle ? <span className="block truncate text-[11px] text-accent">{subtitle}</span> : null}
            </span>
          ) : null}
        </Link>
        {right ? <div className="shrink-0 px-2 sm:px-0">{right}</div> : null}
      </div>
    </header>
  );
}
