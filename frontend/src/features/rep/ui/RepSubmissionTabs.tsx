"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/rep/dcr", label: "DCR" },
  { href: "/rep/chemist", label: "Chemist" },
  { href: "/rep/mileage", label: "Mileage" },
  { href: "/rep/expense", label: "Expenses" },
];

export default function RepSubmissionTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div className="rep-tabs" role="navigation" aria-label="Rep submissions">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? "rep-tab rep-tab--active" : "rep-tab"}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
