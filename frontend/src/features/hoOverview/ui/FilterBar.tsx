"use client";

import type {
  CompanyOverviewFilters,
  CompanyOverviewPeriod,
  Grade,
} from "../types";
import { useRoutesLookup } from "../hooks";

function asGrade(v: string): Grade | undefined {
  return v === "A" || v === "B" || v === "C" ? v : undefined;
}

type Props = {
  value: CompanyOverviewFilters;
  onChange: (next: CompanyOverviewFilters) => void;
  canSelectFieldManager: boolean;
  isFetching?: boolean;
};

function toInt(v: string): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  return i > 0 ? i : undefined;
}

function toggleId(list: number[] | undefined, id: number): number[] {
  const cur = Array.isArray(list) ? list : [];
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

export function FilterBar({
  value,
  onChange,
  canSelectFieldManager,
  isFetching,
}: Props) {
  const routesQ = useRoutesLookup();
  const routes = routesQ.data ?? [];

  const period = value.period;

  const onPeriod = (p: CompanyOverviewPeriod) => {
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
            onChange={(e) => onPeriod(e.target.value as CompanyOverviewPeriod)}
          >
            <option value="THIS_MONTH">THIS_MONTH</option>
            <option value="LAST_MONTH">LAST_MONTH</option>
            <option value="CUSTOM">CUSTOM</option>
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

        <div>
          <div className="text-xs text-zinc-600">Grade (optional)</div>
          <select
            className="rounded border px-2 py-1"
            value={value.grade ?? ""}
            onChange={(e) =>
              onChange({ ...value, grade: asGrade(e.target.value) })
            }
          >
            <option value="">All</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>

        {canSelectFieldManager ? (
          <div>
            <div className="text-xs text-zinc-600">Field Manager ID (CM)</div>
            <input
              className="w-40 rounded border px-2 py-1"
              type="number"
              min={1}
              placeholder="e.g. 2"
              value={value.fieldManagerId ?? ""}
              onChange={(e) =>
                onChange({ ...value, fieldManagerId: toInt(e.target.value) })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs text-zinc-600">Routes (optional)</div>
        <div className="max-h-32 w-full overflow-auto rounded border p-2 md:w-[420px]">
          {routesQ.isLoading ? (
            <div className="text-sm text-zinc-600">Loading routes…</div>
          ) : routes.length === 0 ? (
            <div className="text-sm text-zinc-600">No routes available.</div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {routes.slice(0, 60).map((r: any) => {
                const id = Number(r.routeId ?? r.id);
                const checked =
                  Number.isFinite(id) &&
                  (value.routeIds ?? []).includes(id as number);
                const label =
                  `${String(r.routeCode ?? r.code ?? "ROUTE")} — ${String(
                    r.routeName ?? r.name ?? "",
                  )}`.trim();
                return (
                  <label
                    key={label}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!!checked}
                      disabled={!Number.isFinite(id)}
                      onChange={() =>
                        onChange({
                          ...value,
                          routeIds: Number.isFinite(id)
                            ? toggleId(value.routeIds, id as number)
                            : value.routeIds,
                        })
                      }
                    />
                    <span className="text-zinc-800">{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {isFetching ? "Refreshing…" : " "}
        </div>
      </div>
    </div>
  );
}
