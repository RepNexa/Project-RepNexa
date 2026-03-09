"use client";

import * as React from "react";
import Link from "next/link";
import type { ApiError } from "@/src/lib/api/types";
import { normalizeRoutes } from "../api";
import { useRepContext, useRepTodo, useTargets } from "../hooks";
import { RepTodoTable } from "./RepTodoTable";

function monthNow(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function ErrorBanner({ err }: { err: ApiError }) {
  const authish = err.status === 401 || err.code === "AUTH_REQUIRED";
  const forbidden = err.status === 403;
  return (
    <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm">
      <div className="font-medium">Request failed</div>
      <div className="mt-1 text-red-900">
        <span className="font-mono">{err.status}</span>{" "}
        <span className="font-mono">{err.code}</span> <span>{err.message}</span>
      </div>
      {(authish || forbidden) && (
        <div className="mt-2">
          <Link className="underline" href="/login">
            Go to /login
          </Link>
        </div>
      )}
    </div>
  );
}

function SkeletonTable() {
  const rows = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="overflow-hidden rounded border">
      <div className="grid grid-cols-7 gap-2 border-b bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
        <div>Doctor</div>
        <div>Grade</div>
        <div className="text-right">Planned</div>
        <div className="text-right">Visits</div>
        <div className="text-right">Remaining</div>
        <div>Last visit</div>
        <div>At risk</div>
      </div>
      {rows.map((i) => (
        <div
          key={i}
          className="grid grid-cols-7 gap-2 border-b px-3 py-3 last:border-b-0"
        >
          {Array.from({ length: 7 }, (_, j) => (
            <div
              key={j}
              className="h-4 w-full animate-pulse rounded bg-zinc-200"
            />
          ))}
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

  return (
    <div style={{ padding: 24 }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">To-do</div>
          <div className="text-sm text-zinc-600">
            Planned vs actual visits by route and month.
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/rep"
            className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>
      </div>

      {err && <ErrorBanner err={err} />}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600">Route</span>
          <select
            className="h-10 min-w-[240px] rounded border px-2"
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
            className="h-10 rounded border px-2"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : routeId === null ? (
        <div className="rounded border bg-white p-4">
          <div className="font-medium">No routes available</div>
          <div className="text-sm text-zinc-600">
            You don’t have any active route assignments.
          </div>
        </div>
      ) : (todo.data?.rows?.length ?? 0) === 0 ? (
        <div className="rounded border bg-white p-4">
          <div className="font-medium">No doctors for this route/month</div>
          <div className="text-sm text-zinc-600">
            If you expect doctors here, verify doctor-route assignments and call
            data on the backend.
          </div>
        </div>
      ) : (
        <RepTodoTable
          month={month}
          rows={todo.data!.rows}
          targets={targets.data ?? { A: 6, B: 4, C: 2 }}
        />
      )}
    </div>
  );
}
