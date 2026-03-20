"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const labelClassName =
  "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const controlClassName =
  "h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

export function FilterBar({
  value,
  onChange,
  canSelectFieldManager,
  isFetching,
}: Props) {
  const routesQ = useRoutesLookup();
  const routes = routesQ.data ?? [];
  const period = value.period;

  const [routesOpen, setRoutesOpen] = useState(false);
  const routesRef = useRef<HTMLDivElement | null>(null);

  const selectedRouteLabels = useMemo(() => {
    const selectedIds = value.routeIds ?? [];
    if (selectedIds.length === 0) return "All routes";

    const labels = routes
      .map((r: any) => {
        const id = Number(r.routeId ?? r.id);
        if (!Number.isFinite(id) || !selectedIds.includes(id)) return null;
        return String(
          r.routeCode ?? r.code ?? r.routeName ?? r.name ?? `Route ${id}`,
        );
      })
      .filter(Boolean) as string[];

    if (labels.length === 0) {
      return `${selectedIds.length} route${selectedIds.length === 1 ? "" : "s"} selected`;
    }
    if (labels.length === 1) return labels[0];
    return `${labels[0]} +${labels.length - 1} more`;
  }, [routes, value.routeIds]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!routesRef.current) return;
      if (!routesRef.current.contains(event.target as Node)) {
        setRoutesOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setRoutesOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const onPeriod = (p: CompanyOverviewPeriod) => {
    onChange({
      ...value,
      period: p,
      dateFrom: p === "CUSTOM" ? value.dateFrom : undefined,
      dateTo: p === "CUSTOM" ? value.dateTo : undefined,
    });
  };

  return (
    <div className="pb-1">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className={labelClassName}>Period</div>
            <select
              className={controlClassName}
              value={period}
              onChange={(e) => onPeriod(e.target.value as CompanyOverviewPeriod)}
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {period === "CUSTOM" ? (
            <>
              <div>
                <div className={labelClassName}>From</div>
                <input
                  className={controlClassName}
                  type="date"
                  value={value.dateFrom ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, dateFrom: e.target.value || undefined })
                  }
                />
              </div>

              <div>
                <div className={labelClassName}>To</div>
                <input
                  className={controlClassName}
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
            <div className={labelClassName}>Grade</div>
            <select
              className={controlClassName}
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
              <div className={labelClassName}>Field Manager ID</div>
              <input
                className={controlClassName}
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

        <div className="min-w-0" ref={routesRef}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className={labelClassName}>Routes</div>
            <div className="text-[11px] font-medium text-zinc-500">
              {isFetching ? "Refreshing…" : "\u00A0"}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setRoutesOpen((prev) => !prev)}
              className="flex h-11 w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 text-left text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-300 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
              aria-haspopup="listbox"
              aria-expanded={routesOpen}
            >
              <span className="truncate">{selectedRouteLabels}</span>
              <span className="ml-3 text-zinc-500">{routesOpen ? "▲" : "▼"}</span>
            </button>

            {routesOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg">
                {routesQ.isLoading ? (
                  <div className="px-3 py-2 text-sm text-zinc-600">
                    Loading routes…
                  </div>
                ) : routes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-zinc-600">
                    No routes available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {routes.slice(0, 60).map((r: any, idx: number) => {
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
                          key={`${label}-${idx}`}
                          className="flex min-w-0 items-start gap-3 rounded-xl px-3 py-2 transition hover:bg-zinc-50"
                        >
                          <input
                            className="mt-1 h-4 w-4 rounded border-zinc-300 accent-violet-600"
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
                          <span className="min-w-0 break-words text-sm font-medium leading-5 text-zinc-800">
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}