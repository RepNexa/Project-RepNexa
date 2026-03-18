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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function RepSubmissionTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div
      role="navigation"
      aria-label="Rep submissions"
      className="overflow-x-auto"
    >
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:min-w-0">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);

          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-violet-600 text-white shadow-sm"
                  : "border border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}