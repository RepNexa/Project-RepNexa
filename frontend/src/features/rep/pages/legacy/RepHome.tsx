"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";

import { apiFetch } from "@/src/lib/api/client";
import {
  isApiError,
  type ApiError,
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
  assignedRoutes?: AssignedRoute[]; // tolerate either shape
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

        const list = (ctx?.routes ??
          ctx?.assignedRoutes ??
          []) as AssignedRoute[];
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

  return (
    <AppShell title="Rep Portal (MR)">
      <RequireRole role="MR">
        <div className="max-w-3xl space-y-4">
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-zinc-700">
              Choose what you want to submit for the day. DCR and Chemist
              require a route context (routeId + repRouteAssignmentId).
            </div>

            {err ? (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            {loading ? (
              <div className="mt-3 text-sm text-zinc-600">
                Loading assignments…
              </div>
            ) : routes.length === 0 ? (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                No active assignments for this MR.
                <div className="mt-2">
                  You can still open Mileage, but submissions will be blocked
                  until an assignment exists.
                </div>
                <div className="mt-3">
                  <Link className="underline" href="/rep/mileage">
                    Go to Mileage
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {!loading && routes.length > 0 ? (
            <div className="space-y-3">
              {routes.map((r) => {
                const qp = `routeId=${encodeURIComponent(
                  r.routeId,
                )}&rraId=${encodeURIComponent(r.repRouteAssignmentId)}`;

                return (
                  <div
                    key={r.repRouteAssignmentId}
                    className="rounded border bg-white p-4"
                  >
                    <div className="font-medium">
                      {r.routeCode} – {r.routeName}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Territory: {r.territoryName ?? "—"} |
                      RepRouteAssignmentId: <b>{r.repRouteAssignmentId}</b>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        className="rounded bg-black px-3 py-2 text-sm text-white"
                        href={`/rep/dcr?${qp}`}
                      >
                        DCR Submission
                      </Link>

                      <Link
                        className="rounded bg-black px-3 py-2 text-sm text-white"
                        href={`/rep/chemist?${qp}`}
                      >
                        Chemist Report
                      </Link>

                      <Link
                        className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
                        href={`/rep/mileage?rraId=${encodeURIComponent(
                          r.repRouteAssignmentId,
                        )}`}
                      >
                        Mileage
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rounded border bg-white p-4">
            <div className="font-medium">Direct links</div>
            <div className="mt-2 text-sm text-zinc-700">
              These load the pages, but DCR/Chemist will warn you unless you
              opened them with routeId + rraId.
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link className="underline" href="/rep/dcr">
                /rep/dcr
              </Link>
              <Link className="underline" href="/rep/chemist">
                /rep/chemist
              </Link>
              <Link className="underline" href="/rep/mileage">
                /rep/mileage
              </Link>
            </div>
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}
