"use client";

import { formatNumber, formatPercent } from "./format";

export function SimpleBarList({
  items,
  labelMinWidthClassName,
}: {
  items: Array<{
    label: string;
    value: number | null;
    format?: "number" | "percent";
    colorClassName?: string;
  }>;
  labelMinWidthClassName?: string;
}) {
  const numericValues = items.map((i) => {
    if (typeof i.value !== "number" || !Number.isFinite(i.value)) return 0;
    return i.format === "percent" ? i.value * 100 : i.value;
  });

  const maxNumberValue = Math.max(0, ...numericValues);

  return (
    <div className="space-y-4">
      {items.map((i, idx) => {
        const rawValue =
          typeof i.value === "number" && Number.isFinite(i.value)
            ? i.value
            : null;

        const fillWidthPercent =
          rawValue === null
            ? 0
            : i.format === "percent"
              ? Math.max(0, Math.min(100, rawValue * 100))
              : maxNumberValue <= 0
                ? 0
                : Math.max(0, Math.min(100, (rawValue / maxNumberValue) * 100));

        const text =
          i.format === "percent"
            ? formatPercent(rawValue)
            : formatNumber(rawValue);

        return (
          <div
            key={`${i.label}-${idx}`}
            className="grid min-w-0 grid-cols-[minmax(88px,auto)_minmax(0,1fr)_56px] items-center gap-3"
          >
            <div
              className={`truncate text-sm font-medium text-zinc-700 ${labelMinWidthClassName ?? ""}`}
              title={i.label}
            >
              {i.label}
            </div>

            <div className="min-w-0">
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    i.colorClassName ?? "bg-violet-500"
                  }`}
                  style={{ width: `${fillWidthPercent}%` }}
                />
              </div>
            </div>

            <div className="text-right text-sm font-semibold text-zinc-900">
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
}