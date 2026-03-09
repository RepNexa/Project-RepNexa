"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";

import { apiFetch } from "@/src/lib/api/client";
import {
  isApiError,
  type ApiFieldError,
} from "@/src/lib/api/types";

type AssignedRoute = {
  repRouteAssignmentId: number;
  routeId: number;
  routeCode: string;
  routeName: string;
  territoryId?: number;
  territoryCode?: string;
  territoryName?: string;
};

type RepContext = {
  userId?: number;
  routes?: AssignedRoute[];
  assignedRoutes?: AssignedRoute[];
};

function fmtErr(e: unknown): string {
  if (isApiError(e)) {
    const fields = (e.fieldErrors ?? [])
      .map((f: ApiFieldError) => `${f.field}: ${f.message}`)
      .join("; ");
    return fields
      ? `${e.code}: ${e.message} (${fields})`
      : `${e.code}: ${e.message}`;
  }
  const msg = e instanceof Error ? e.message : "";
  return msg || "Request failed";
}

function SummaryCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "default" | "violet" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
      >
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-zinc-600">{note}</div>
    </div>
  );
}

export default function RepHomePage() {
  const [routes, setRoutes] = useState<AssignedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const ctx = await apiFetch<RepContext>("/rep/context", {
          method: "GET",
          requireCsrf: false,
        });

        const list = (ctx?.routes ?? ctx?.assignedRoutes ?? []) as AssignedRoute[];
        if (!alive) return;

        setRoutes(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!alive) return;
        setRoutes([]);
        setErr(fmtErr(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const territories = new Set(
      routes.map((r) => r.territoryName).filter(Boolean)
    ).size;

    return {
      routeCount: routes.length,
      territoryCount: territories,
      hasAssignments: routes.length > 0 ? "Yes" : "No",
    };
  }, [routes]);

  return (
    <AppShell title="Rep Portal (MR)">
      <RequireRole role="MR">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Field App
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  Home
                </div>
                <div className="mt-2 max-w-2xl text-sm text-zinc-600">
                  Open your daily field workflows from one place. DCR and Chemist
                  Report need a valid route assignment context.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
                <Link
                  href="/rep/mileage"
                  className="inline-flex items-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                >
                  Open Mileage
                </Link>
              </div>
            </div>
          </div>

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Assigned routes"
              value={loading ? "…" : stats.routeCount}
              note="Active route assignments"
              tone="violet"
            />
            <SummaryCard
              label="Territories"
              value={loading ? "…" : stats.territoryCount}
              note="Territories in your current scope"
            />
            <SummaryCard
              label="Assignments"
              value={loading ? "…" : stats.hasAssignments}
              note="Route context availability"
              tone={routes.length > 0 ? "emerald" : "amber"}
            />
            <SummaryCard
              label="Quick access"
              value="4"
              note="Main MR workflows"
            />
          </div>

          {loading ? (
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="text-sm text-zinc-600">Loading assignments…</div>
            </div>
          ) : routes.length === 0 ? (
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No active assignments for this MR. You can still open pages like
                Mileage, but submission will be blocked until an assignment exists.
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/rep/mileage"
                  className="inline-flex items-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                >
                  Go to Mileage
                </Link>
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">
                      Assigned routes
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Choose a route and open the workflow you want to use.
                    </div>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {routes.length}
                  </div>
                </div>

                <div className="space-y-4">
                  {routes.map((r) => {
                    const qp = `routeId=${encodeURIComponent(
                      r.routeId
                    )}&rraId=${encodeURIComponent(r.repRouteAssignmentId)}`;

                    return (
                      <div
                        key={r.repRouteAssignmentId}
                        className="rounded-2xl border bg-zinc-50 p-5 transition-colors hover:bg-white"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-zinc-900">
                              {r.routeCode} – {r.routeName}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-700">
                                {r.territoryName ?? "No territory"}
                              </span>
                              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-700">
                                Assignment #{r.repRouteAssignmentId}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <Link
                            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                            href={`/rep/dcr?${qp}`}
                          >
                            DCR Submission
                          </Link>

                          <Link
                            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                            href={`/rep/chemist?${qp}`}
                          >
                            Chemist Report
                          </Link>

                          <Link
                            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                            href={`/rep/mileage?rraId=${encodeURIComponent(
                              r.repRouteAssignmentId
                            )}`}
                          >
                            Mileage
                          </Link>

                          <Link
                            className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                            href="/rep/todo"
                          >
                            To-do
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </RequireRole>
    </AppShell>
  );
}