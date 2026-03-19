"use client";

import * as React from "react";
import Link from "next/link";
import type { ApiError } from "@/src/lib/api/types";
import type { RepTodoRow, TargetsResponse } from "../api";
import { normalizeRoutes } from "../api";
import {
  useRepContext,
  useRepMasterChanges,
  useRepTodo,
  useTargets,
} from "../hooks";
import { RepMasterChangesPanel } from "./RepMasterChangesPanel";
import { RepTodoTable } from "./RepTodoTable";

function monthNow(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computePlanned(row: RepTodoRow, targets: TargetsResponse): number {
  if (typeof row.planned === "number") return row.planned;
  const grade = (row.doctorGrade ?? row.grade ?? "") as string;
  const target = targets[grade];
  return typeof target === "number" ? target : 0;
}

function computeVisits(row: RepTodoRow): number {
  if (typeof row.visitsThisMonth === "number") return row.visitsThisMonth;
  if (typeof row.visits === "number") return row.visits;
  return 0;
}

function computeRemaining(
  row: RepTodoRow,
  planned: number,
  visits: number,
): number {
  if (typeof row.remaining === "number") return row.remaining;
  return Math.max(planned - visits, 0);
}

function computeAtRisk(
  row: RepTodoRow,
  planned: number,
  visits: number,
): boolean {
  if (typeof row.atRisk === "boolean") return row.atRisk;
  return planned > 0 && visits === 0;
}

function prettyMonth(month: string): string {
  const [yyyy, mm] = month.split("-");
  const monthIndex = Number(mm) - 1;
  const year = Number(yyyy);

  if (!Number.isFinite(monthIndex) || !Number.isFinite(year)) return month;

  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function ErrorBanner({ err }: { err: ApiError }) {
  const authish = err.status === 401 || err.code === "AUTH_REQUIRED";
  const forbidden = err.status === 403;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm shadow-sm">
      <div className="font-semibold text-red-900">Couldn’t load to-do data</div>
      <div className="mt-1 text-red-900">
        <span className="font-mono">{err.status}</span>{" "}
        <span className="font-mono">{err.code}</span> <span>{err.message}</span>
      </div>

      {(authish || forbidden) && (
        <div className="mt-3">
          <Link
            className="inline-flex min-h-[44px] items-center rounded-full border border-red-300 bg-white px-4 py-2 text-sm hover:bg-red-50"
            href="/login"
          >
            Go to login
          </Link>
        </div>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
          <div className="mt-4 h-8 w-20 animate-pulse rounded bg-zinc-200" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  const rows = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-4 sm:px-6">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
      </div>

      <div className="hidden grid-cols-8 gap-2 border-b bg-zinc-50 px-6 py-3 text-xs font-medium text-zinc-700 md:grid">
        <div>Doctor</div>
        <div>Grade</div>
        <div>Territory</div>
        <div className="text-right">Planned</div>
        <div className="text-right">Visits</div>
        <div className="text-right">Remaining</div>
        <div>Last visit</div>
        <div>Status</div>
      </div>

      <div className="divide-y md:hidden">
        {rows.map((i) => (
          <div key={i} className="space-y-3 px-4 py-4">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, j) => (
                <div
                  key={j}
                  className="h-16 animate-pulse rounded-xl bg-zinc-100"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden divide-y md:block">
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-8 gap-2 px-6 py-4">
            {Array.from({ length: 8 }, (_, j) => (
              <div
                key={j}
                className="h-4 w-full animate-pulse rounded bg-zinc-200"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
        !
      </div>
      <div className="text-lg font-semibold tracking-tight">{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{description}</div>
    </div>
  );
}

function QuickAction({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex min-h-[44px] items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          : "inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

function SummaryCards({
  rows,
  targets,
}: {
  rows: RepTodoRow[];
  targets: TargetsResponse;
}) {
  const summary = React.useMemo(() => {
    let totalDoctors = rows.length;
    let atRisk = 0;
    let planned = 0;
    let visits = 0;
    let remaining = 0;
    let completedDoctors = 0;

    for (const row of rows) {
      const p = safeNum(computePlanned(row, targets));
      const v = safeNum(computeVisits(row));
      const r = safeNum(computeRemaining(row, p, v));
      const risk = computeAtRisk(row, p, v);

      planned += p;
      visits += v;
      remaining += r;
      if (risk) atRisk += 1;
      if (p > 0 && r === 0) completedDoctors += 1;
    }

    const coverage = planned > 0 ? Math.round((visits / planned) * 100) : 0;

    return {
      totalDoctors,
      atRisk,
      planned,
      visits,
      remaining,
      completedDoctors,
      coverage,
    };
  }, [rows, targets]);

  const cards = [
    {
      label: "Doctors",
      value: summary.totalDoctors,
      note: "In current route",
      accent: "border-violet-200 bg-violet-50 text-violet-700",
    },
    {
      label: "At risk",
      value: summary.atRisk,
      note: "Need attention now",
      accent:
        summary.atRisk > 0
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Progress",
      value: `${summary.visits}/${summary.planned}`,
      note: `${summary.coverage}% of target completed`,
      accent: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    {
      label: "Fully covered",
      value: summary.completedDoctors,
      note: `${summary.remaining} visits still remaining`,
      accent: "border-zinc-200 bg-zinc-50 text-zinc-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${card.accent}`}
          >
            {card.label}
          </div>
          <div className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {card.value}
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-600">
            {card.note}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RepTodoPage() {
  const [month, setMonth] = React.useState(monthNow());
  const [routeId, setRouteId] = React.useState<number | null>(null);

  const ctx = useRepContext();
  const targets = useTargets();
  const todo = useRepTodo({ month, routeId });
  const masterChanges = useRepMasterChanges({ routeId, limit: 5 });

  const routes = React.useMemo(
    () => normalizeRoutes(ctx.data ?? {}, todo.data ?? null),
    [ctx.data, todo.data],
  );

  React.useEffect(() => {
    if (routeId !== null) return;
    if (!routes || routes.length === 0) return;
    setRouteId(routes[0]!.id);
  }, [routeId, routes]);

  const loading =
    ctx.isLoading || targets.isLoading || (todo.isLoading && !todo.data);

  const err: ApiError | null =
    (ctx.error as any) || (targets.error as any) || (todo.error as any) || null;

  const targetValues = targets.data ?? { A: 6, B: 4, C: 2 };
  const rows = todo.data?.rows ?? [];

  const selectedRoute = React.useMemo(
    () => routes.find((r) => r.id === routeId) ?? null,
    [routes, routeId],
  );

  const quickSummary = React.useMemo(() => {
    let atRisk = 0;
    let dueToday = 0;

    for (const row of rows) {
      const planned = safeNum(computePlanned(row, targetValues));
      const visits = safeNum(computeVisits(row));
      const remaining = safeNum(computeRemaining(row, planned, visits));
      const risk = computeAtRisk(row, planned, visits);

      if (risk) atRisk += 1;
      if (remaining > 0) dueToday += 1;
    }

    return { atRisk, dueToday };
  }, [rows, targetValues]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
                Field App
              </div>

              <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                To-do & Alerts
              </div>

              <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                {/* we can add a note */}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  {selectedRoute
                    ? (selectedRoute.code ??
                      selectedRoute.name ??
                      `Route #${selectedRoute.id}`)
                    : "No route selected"}
                </span>
                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  {prettyMonth(month)}
                </span>
                <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                  {quickSummary.atRisk} at risk
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
              <QuickAction href="/rep/dcr" primary>
                Open DCR
              </QuickAction>
              <QuickAction href="/rep/chemist">Chemist report</QuickAction>
            </div>
          </div>
        </div>

        {err && <ErrorBanner err={err} />}

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4">
              <div className="text-sm font-medium text-zinc-900">
                Focus panel
              </div>
              <div className="mt-1 text-sm leading-6 text-zinc-600">
                {/* we can add notes */}
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Route</span>
                <select
                  className="min-h-[44px] rounded-xl border border-zinc-200 px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                  value={routeId ?? ""}
                  onChange={(e) =>
                    setRouteId(e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={routes.length === 0}
                >
                  {routes.length === 0 ? (
                    <option value="">No routes</option>
                  ) : (
                    routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code ?? r.name ?? `Route #${r.id}`}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Month</span>
                <input
                  className="min-h-[44px] rounded-xl border border-zinc-200 px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-900">
                Current focus
              </div>

              <div className="mt-3 grid gap-3">
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-zinc-500">Route</div>
                  <div className="mt-1 break-words font-medium text-zinc-900">
                    {selectedRoute
                      ? (selectedRoute.code ??
                        selectedRoute.name ??
                        `Route #${selectedRoute.id}`)
                      : "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-zinc-500">Month</div>
                  <div className="mt-1 font-medium text-zinc-900">
                    {prettyMonth(month)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs text-zinc-500">At risk</div>
                    <div className="mt-1 text-lg font-semibold text-red-700">
                      {quickSummary.atRisk}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-3">
                    <div className="text-xs text-zinc-500">Need visits</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">
                      {quickSummary.dueToday}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {loading ? (
              <>
                <SummarySkeleton />
                <SkeletonTable />
              </>
            ) : routeId === null ? (
              <EmptyState
                title="No routes available"
                description="You don’t have any active route assignments at the moment."
              />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No doctors for this route and month"
                description="If you expected doctors here, check route assignments and doctor mapping."
              />
            ) : (
              <>
                <SummaryCards rows={rows} targets={targetValues} />

                <RepMasterChangesPanel
                  items={masterChanges.data?.items ?? []}
                  isLoading={masterChanges.isLoading && !masterChanges.data}
                  error={(masterChanges.error as ApiError | null) ?? null}
                />

                <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                  <RepTodoTable
                    month={month}
                    rows={rows}
                    targets={targetValues}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
