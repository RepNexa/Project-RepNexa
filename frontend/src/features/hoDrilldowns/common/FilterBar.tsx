"use client";

import * as React from "react";
import type { DrilldownFilters, DrilldownPeriod } from "./types";

const PERIOD_OPTIONS: Array<{ value: DrilldownPeriod; label: string }> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "CUSTOM", label: "Custom" },
];

export function DrilldownFilterBar({
  value,
  onChange,
  isFetching,
}: {
  value: DrilldownFilters;
  onChange: (next: DrilldownFilters) => void;
  isFetching?: boolean;
}) {
  const period = value.period;
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const selectedLabel =
    PERIOD_OPTIONS.find((opt) => opt.value === period)?.label ?? "This Month";

  const onPeriod = (p: DrilldownPeriod) => {
    onChange({
      ...value,
      period: p,
      dateFrom: p === "CUSTOM" ? value.dateFrom : undefined,
      dateTo: p === "CUSTOM" ? value.dateTo : undefined,
    });
    setOpen(false);
  };

  React.useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div ref={rootRef} className="relative">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Period
          </div>

          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-12 min-w-[220px] items-center justify-between rounded-[22px] border border-violet-300/70 bg-white px-5 text-left text-sm font-medium text-zinc-900 shadow-[0_0_0_4px_rgba(139,92,246,0.10)] outline-none transition hover:border-violet-400/80 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          >
            <span>{selectedLabel}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 text-violet-700 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {open ? (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-lg">
              <div role="listbox" aria-label="Period options">
                {PERIOD_OPTIONS.map((opt) => {
                  const selected = opt.value === period;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onPeriod(opt.value)}
                      className={`flex w-full items-center px-5 py-3 text-left text-sm transition ${
                        selected
                          ? "bg-violet-50 font-medium text-violet-700"
                          : "text-zinc-900 hover:bg-zinc-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {period === "CUSTOM" ? (
          <>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                From
              </div>
              <input
                className="h-12 rounded-[22px] border border-violet-300/70 bg-white px-4 text-sm font-medium text-zinc-900 shadow-[0_0_0_4px_rgba(139,92,246,0.10)] outline-none transition hover:border-violet-400/80 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                type="date"
                value={value.dateFrom ?? ""}
                onChange={(e) =>
                  onChange({ ...value, dateFrom: e.target.value || undefined })
                }
              />
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                To
              </div>
              <input
                className="h-12 rounded-[22px] border border-violet-300/70 bg-white px-4 text-sm font-medium text-zinc-900 shadow-[0_0_0_4px_rgba(139,92,246,0.10)] outline-none transition hover:border-violet-400/80 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                type="date"
                value={value.dateTo ?? ""}
                onChange={(e) =>
                  onChange({ ...value, dateTo: e.target.value || undefined })
                }
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="min-h-[1rem] text-xs font-medium text-zinc-500 md:text-right">
        {isFetching ? "Refreshing…" : " "}
      </div>
    </div>
  );
}