import Link from "next/link";

export function ListPagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  const previous = page > 1 ? hrefForPage(page - 1) : null;
  const next = page < totalPages ? hrefForPage(page + 1) : null;

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-3">
        {previous ? (
          <Link href={previous} className="text-xs text-muted underline hover:text-accent-dark">
            Previous
          </Link>
        ) : (
          <span className="text-xs text-muted">Previous</span>
        )}
        {next ? (
          <Link href={next} className="text-xs text-muted underline hover:text-accent-dark">
            Next
          </Link>
        ) : (
          <span className="text-xs text-muted">Next</span>
        )}
      </div>
    </div>
  );
}
