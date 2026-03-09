"use client";

import { formatNumber, formatPercent } from "./format";

export function SimpleBarList({
  items,
}: {
  items: Array<{
    label: string;
    value: number | null;
    format?: "number" | "percent";
  }>;
}) {
  const max = Math.max(
    0,
    ...items.map((i) =>
      typeof i.value === "number" && Number.isFinite(i.value) ? i.value : 0,
    ),
  );

  return (
    <div className="space-y-2">
      {items.map((i) => {
        const v =
          typeof i.value === "number" && Number.isFinite(i.value)
            ? i.value
            : null;
        const pct =
          v === null || max <= 0
            ? 0
            : Math.max(0, Math.min(100, (v / max) * 100));
        const text =
          i.format === "percent" ? formatPercent(v) : formatNumber(v);
        return (
          <div
            key={i.label}
            className="grid grid-cols-[140px_1fr_80px] items-center gap-2"
          >
            <div className="truncate text-sm text-zinc-700">{i.label}</div>
            <div className="h-2 overflow-hidden rounded bg-zinc-100">
              <div className="h-2 bg-zinc-800" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-sm text-zinc-800">{text}</div>
          </div>
        );
      })}
    </div>
  );
}
