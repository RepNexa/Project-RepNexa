"use client";

import type { DrilldownFilters, DrilldownPeriod } from "./types";

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

  const onPeriod = (p: DrilldownPeriod) => {
    onChange({
      ...value,
      period: p,
      dateFrom: p === "CUSTOM" ? value.dateFrom : undefined,
      dateTo: p === "CUSTOM" ? value.dateTo : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-zinc-600">Period</div>
          <select
            className="rounded border px-2 py-1"
            value={period}
            onChange={(e) => onPeriod(e.target.value as DrilldownPeriod)}
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>

        {period === "CUSTOM" ? (
          <>
            <div>
              <div className="text-xs text-zinc-600">From</div>
              <input
                className="rounded border px-2 py-1"
                type="date"
                value={value.dateFrom ?? ""}
                onChange={(e) =>
                  onChange({ ...value, dateFrom: e.target.value || undefined })
                }
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600">To</div>
              <input
                className="rounded border px-2 py-1"
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

      <div className="text-xs text-zinc-500">
        {isFetching ? "Refreshing…" : " "}
      </div>
    </div>
  );
}
