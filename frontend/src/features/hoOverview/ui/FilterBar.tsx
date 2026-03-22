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

const PERIOD_OPTIONS: Array<{
  value: CompanyOverviewPeriod;
  label: string;
}> = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "CUSTOM", label: "Custom" },
];

const GRADE_OPTIONS: Array<{
  value: "" | Grade;
  label: string;
}> = [
  { value: "", label: "All" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

const labelClassName =
  "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

const controlClassName =
  "h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100";

const triggerClassName =
  "flex h-11 w-full items-center justify-between rounded-2xl border border-violet-300/70 bg-white px-4 text-left text-sm font-medium text-zinc-900 shadow-[0_0_0_4px_rgba(139,92,246,0.08)] transition hover:border-violet-400/80 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-100";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-5 w-5 text-violet-700 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
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

  const [routesOpen, setRoutesOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);

  const routesRef = useRef<HTMLDivElement | null>(null);
  const periodRef = useRef<HTMLDivElement | null>(null);
  const gradeRef = useRef<HTMLDivElement | null>(null);

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

  const selectedPeriodLabel =
    PERIOD_OPTIONS.find((opt) => opt.value === period)?.label ?? "This Month";

  const selectedGradeLabel =
    GRADE_OPTIONS.find((opt) => opt.value === (value.grade ?? ""))?.label ??
    "All";

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (routesRef.current && !routesRef.current.contains(target)) {
        setRoutesOpen(false);
      }
      if (periodRef.current && !periodRef.current.contains(target)) {
        setPeriodOpen(false);
      }
      if (gradeRef.current && !gradeRef.current.contains(target)) {
        setGradeOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRoutesOpen(false);
        setPeriodOpen(false);
        setGradeOpen(false);
      }
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
    setPeriodOpen(false);
  };

  const onGrade = (g: "" | Grade) => {
    onChange({
      ...value,
      grade: asGrade(g),
    });
    setGradeOpen(false);
  };

  return (
    <div className="pb-1">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div ref={periodRef} className="relative">
            <div className={labelClassName}>Period</div>
            <button
              type="button"
              onClick={() => {
                setPeriodOpen((prev) => !prev);
                setGradeOpen(false);
                setRoutesOpen(false);
              }}
              className={triggerClassName}
              aria-haspopup="listbox"
              aria-expanded={periodOpen}
            >
              <span className="truncate">{selectedPeriodLabel}</span>
              <span className="ml-3">
                <Chevron open={periodOpen} />
              </span>
            </button>

            {periodOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-violet-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(24,24,27,0.12),0_8px_20px_rgba(139,92,246,0.12)]">
                <div role="listbox" aria-label="Period options" className="grid grid-cols-1 gap-1.5">
                  {PERIOD_OPTIONS.map((opt) => {
                    const selected = opt.value === period;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => onPeriod(opt.value)}
                        className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                          selected
                            ? "bg-violet-600 text-white"
                            : "text-zinc-800 hover:bg-violet-50 hover:text-violet-700"
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

          <div ref={gradeRef} className="relative">
            <div className={labelClassName}>Grade</div>
            <button
              type="button"
              onClick={() => {
                setGradeOpen((prev) => !prev);
                setPeriodOpen(false);
                setRoutesOpen(false);
              }}
              className={triggerClassName}
              aria-haspopup="listbox"
              aria-expanded={gradeOpen}
            >
              <span className="truncate">{selectedGradeLabel}</span>
              <span className="ml-3">
                <Chevron open={gradeOpen} />
              </span>
            </button>

            {gradeOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-violet-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(24,24,27,0.12),0_8px_20px_rgba(139,92,246,0.12)]">
                <div role="listbox" aria-label="Grade options" className="grid grid-cols-1 gap-1.5">
                  {GRADE_OPTIONS.map((opt) => {
                    const selected = opt.value === (value.grade ?? "");
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => onGrade(opt.value)}
                        className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                          selected
                            ? "bg-violet-600 text-white"
                            : "text-zinc-800 hover:bg-violet-50 hover:text-violet-700"
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
              onClick={() => {
                setRoutesOpen((prev) => !prev);
                setPeriodOpen(false);
                setGradeOpen(false);
              }}
              className={triggerClassName}
              aria-haspopup="listbox"
              aria-expanded={routesOpen}
            >
              <span className="truncate">{selectedRouteLabels}</span>
              <span className="ml-3">
                <Chevron open={routesOpen} />
              </span>
            </button>

            {routesOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-violet-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(24,24,27,0.12),0_8px_20px_rgba(139,92,246,0.12)]">
                {routesQ.isLoading ? (
                  <div className="px-3 py-2 text-sm text-zinc-600">
                    Loading routes…
                  </div>
                ) : routes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-zinc-600">
                    No routes available.
                  </div>
                ) : (
                  <div className="grid max-h-80 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
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
                          className={`flex min-w-0 items-start gap-3 rounded-xl px-3 py-2 transition ${
                            checked ? "bg-violet-50" : "hover:bg-zinc-50"
                          }`}
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