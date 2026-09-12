"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ListSearch({
  action,
  tab,
  q,
  placeholder,
}: {
  action: string;
  tab: string;
  q: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(q);
  }, [q]);

  useEffect(() => {
    const next = value.trim();
    if (next === q) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (tab !== "active") params.set("tab", tab);
      if (next) params.set("q", next);
      const query = params.toString();
      router.replace(query ? `${action}?${query}` : action);
    }, 300);
    return () => clearTimeout(timeout);
  }, [action, q, router, tab, value]);

  return (
    <div>
      <label className="sr-only" htmlFor="list-search">
        Search
      </label>
      <input
        id="list-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-hairline bg-input px-3 py-2 text-sm text-ink placeholder:text-muted"
      />
    </div>
  );
}
