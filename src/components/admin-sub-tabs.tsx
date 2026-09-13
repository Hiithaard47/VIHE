"use client";

import { usePathname } from "next/navigation";
import { SubTabs } from "@/components/sub-tabs";

export function AdminSubTabs({
  base,
  tabs,
}: {
  base: string;
  tabs: { slug: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <SubTabs
      tabs={tabs}
      hrefFor={(slug) => (slug ? `${base}/${slug}` : base)}
      isActive={(slug) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base)}
    />
  );
}
