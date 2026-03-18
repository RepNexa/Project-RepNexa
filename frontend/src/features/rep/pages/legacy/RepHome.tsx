"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";

import { apiFetch } from "@/src/lib/api/client";
import { isApiError, type ApiFieldError } from "@/src/lib/api/types";

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium sm:text-xs ${toneClass}`}
      >
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{note}</div>
    </div>
  );
}

function ActionButton({
  href,
  children,
  tone = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        tone === "primary"
          ? "inline-flex min-h-[46px] items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          : "inline-flex min-h-[46px] items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

function RouteActionLink({
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
          ? "inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-violet-700"
          : "inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
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
      routes.map((r) => r.territoryName).filter(Boolean),
    ).size;

    return {
      routeCount: routes.length,
      territoryCount: territories,
      hasAssignments: routes.length > 0 ? "Ready" : "Missing",
    };
  }, [routes]);

  const primaryRoute = routes[0] ?? null;
  const primaryRouteQuery = primaryRoute
    ? `routeId=${encodeURIComponent(primaryRoute.routeId)}&rraId=${encodeURIComponent(primaryRoute.repRouteAssignmentId)}`
    : "";

  return (
    <AppShell title="Rep Portal (MR)">
      <RequireRole role="MR">
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
                  Field App
                </div>

                <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  Home
                </div>

                <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  {/* we can add notes */}
                </div>

                {primaryRoute ? (
                  <div className="mt-4 inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    Current quick route: {primaryRoute.routeCode} —{" "}
                    {primaryRoute.routeName}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                <ActionButton
                  href={primaryRoute ? `/rep/dcr?${primaryRouteQuery}` : "/rep/dcr"}
                  tone="primary"
                >
                  Start DCR
                </ActionButton>
                <ActionButton href="/rep/todo">Open To-do</ActionButton>
                <ActionButton
                  href={
                    primaryRoute
                      ? `/rep/chemist?${primaryRouteQuery}`
                      : "/rep/chemist"
                  }
                >
                  Chemist Report
                </ActionButton>
                <ActionButton
                  href={
                    primaryRoute
                      ? `/rep/mileage?rraId=${encodeURIComponent(
                          primaryRoute.repRouteAssignmentId,
                        )}`
                      : "/rep/mileage"
                  }
                >
                  Open Mileage
                </ActionButton>
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
              note="Territories in your scope"
            />
            <SummaryCard
              label="Submission status"
              value={loading ? "…" : stats.hasAssignments}
              note="Route context availability"
              tone={routes.length > 0 ? "emerald" : "amber"}
            />
            <SummaryCard
              label="Quick actions"
              value="4"
              note="Main Field App workflows"
            />
          </div>

          {loading ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="text-sm text-zinc-600">Loading assignments…</div>
            </div>
          ) : routes.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                No active assignments for this MR. You can still open pages like
                Mileage or To-do, but DCR and Chemist submission will be blocked
                until an assignment exists.
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                <ActionButton href="/rep/mileage" tone="primary">
                  Go to Mileage
                </ActionButton>
                <ActionButton href="/rep/todo">Open To-do</ActionButton>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                      Assigned routes
                    </div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">
                      Pick a route and jump straight into the task you need.
                    </div>
                  </div>

                  <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {routes.length} routes
                  </div>
                </div>

                <div className="space-y-4">
                  {routes.map((r) => {
                    const qp = `routeId=${encodeURIComponent(
                      r.routeId,
                    )}&rraId=${encodeURIComponent(r.repRouteAssignmentId)}`;

                    return (
                      <div
                        key={r.repRouteAssignmentId}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:bg-white sm:p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="break-words text-base font-semibold text-zinc-900 sm:text-lg">
                              {r.routeCode} — {r.routeName}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                          <RouteActionLink href={`/rep/dcr?${qp}`} primary>
                            DCR Submission
                          </RouteActionLink>

                          <RouteActionLink href={`/rep/chemist?${qp}`}>
                            Chemist Report
                          </RouteActionLink>

                          <RouteActionLink
                            href={`/rep/mileage?rraId=${encodeURIComponent(
                              r.repRouteAssignmentId,
                            )}`}
                          >
                            Mileage
                          </RouteActionLink>

                          <RouteActionLink href="/rep/todo">
                            To-do
                          </RouteActionLink>
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