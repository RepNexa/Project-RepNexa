"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

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
  tone?: "default" | "violet" | "emerald";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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

export default function MileagePage() {
  const sp = useSearchParams();

  const [routes, setRoutes] = useState<AssignedRoute[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(true);

  const [selectedRraId, setSelectedRraId] = useState<number>(0);
  const [entryDate, setEntryDate] = useState<string>(todayStr());
  const [km, setKm] = useState<string>("10");

  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const rraFromQuery = useMemo(() => {
    const n = Number(sp.get("rraId") ?? "0");
    return Number.isFinite(n) ? n : 0;
  }, [sp]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setLoadingCtx(true);
      setErr(null);

      try {
        const ctx = await apiFetch<any>("/rep/context", { method: "GET" });
        const list: AssignedRoute[] = (ctx?.routes ??
          ctx?.assignedRoutes ??
          []) as AssignedRoute[];

        if (cancelled) return;

        setRoutes(Array.isArray(list) ? list : []);

        const match = Array.isArray(list)
          ? list.find((r) => r.repRouteAssignmentId === rraFromQuery)
          : undefined;

        if (match) setSelectedRraId(match.repRouteAssignmentId);
        else if (Array.isArray(list) && list.length > 0) {
          setSelectedRraId(list[0].repRouteAssignmentId);
        } else {
          setSelectedRraId(0);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(fmtErr(e));
        setRoutes([]);
        setSelectedRraId(0);
      } finally {
        if (!cancelled) setLoadingCtx(false);
      }
    }

    loadContext();
    return () => {
      cancelled = true;
    };
  }, [rraFromQuery]);

  const selectedRoute =
    routes.find((r) => r.repRouteAssignmentId === selectedRraId) ?? null;

  const parsedKm = Number(km);
  const kmValid = Number.isFinite(parsedKm) && parsedKm > 0;
  const canSubmit = !busy && !loadingCtx && !!selectedRraId && kmValid;

  async function submit() {
    setBusy(true);
    setCreatedId(null);
    setErr(null);

    try {
      if (!selectedRraId) {
        throw new Error(
          "No assigned route selected. Create or enable an MR route assignment first."
        );
      }

      if (!kmValid) {
        throw new Error("Enter a valid kilometer value greater than 0.");
      }

      const body = {
        repRouteAssignmentId: selectedRraId,
        entryDate,
        km: parsedKm,
      };

      const res = await apiFetch<{ id: number }>("/rep/mileage-entries", {
        method: "POST",
        body,
      });

      setCreatedId(res.id);
    } catch (e) {
      setErr(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Rep (MR) – Mileage">
      <RequireRole role="MR">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Field App
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  Mileage
                </div>
                <div className="mt-2 max-w-2xl text-sm text-zinc-600">
                  Submit your daily travel distance against an assigned route for
                  expense and activity tracking.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rep/dcr"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open DCR
                </Link>
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Assigned routes"
              value={routes.length}
              note="Active route assignments available"
              tone="violet"
            />
            <SummaryCard
              label="Selected route"
              value={selectedRoute?.routeCode ?? "—"}
              note={selectedRoute?.routeName ?? "Choose a route to continue"}
            />
            <SummaryCard
              label="Entry date"
              value={entryDate}
              note="Mileage submission date"
            />
            <SummaryCard
              label="Kilometers"
              value={km || "0"}
              note="Distance prepared for this entry"
              tone="emerald"
            />
          </div>

          {createdId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
              Mileage submitted successfully. Entry ID: <b>{createdId}</b>
            </div>
          )}

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="mb-6">
                <div className="text-xl font-semibold tracking-tight">
                  Submit mileage entry
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Choose your assigned route, set the date, and enter total
                  kilometers traveled.
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  <span className="text-zinc-600">Assigned route</span>
                  <select
                    className="h-11 rounded-xl border px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                    value={selectedRraId}
                    onChange={(e) => setSelectedRraId(Number(e.target.value))}
                    disabled={loadingCtx}
                  >
                    <option value={0}>
                      {loadingCtx
                        ? "Loading assignments..."
                        : "Select an assigned route"}
                    </option>
                    {routes.map((r) => (
                      <option
                        key={r.repRouteAssignmentId}
                        value={r.repRouteAssignmentId}
                      >
                        {r.routeCode} – {r.routeName}
                        {r.territoryName ? ` (${r.territoryName})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">Entry date</span>
                  <input
                    className="h-11 rounded-xl border px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600">Kilometers (km)</span>
                  <input
                    className="h-11 rounded-xl border px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                    type="number"
                    min="0"
                    step="0.1"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    inputMode="decimal"
                    placeholder="Enter kilometers"
                  />
                </label>
              </div>

              {!loadingCtx && routes.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No active route assignments are available for this MR. To test
                  mileage submissions, create or enable an MR route assignment and
                  refresh this page.
                </div>
              ) : null}

              {selectedRoute ? (
                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <div className="text-sm font-medium text-zinc-900">
                    Selected route details
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs text-zinc-500">Route</div>
                      <div className="mt-1 font-medium text-zinc-900">
                        {selectedRoute.routeCode} – {selectedRoute.routeName}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs text-zinc-500">Territory</div>
                      <div className="mt-1 font-medium text-zinc-900">
                        {selectedRoute.territoryName ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-3 sm:col-span-2">
                      <div className="text-xs text-zinc-500">
                        RepRouteAssignmentId
                      </div>
                      <div className="mt-1 font-medium text-zinc-900">
                        {selectedRoute.repRouteAssignmentId}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600">
                  Mileage is recorded against the selected route assignment and
                  date.
                </div>
                <button
                  disabled={!canSubmit}
                  onClick={submit}
                  className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Submitting..." : "Submit Mileage"}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold tracking-tight">
                  Guidance
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Use this form to record total travel distance for the selected
                  route on the chosen date.
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Before submitting
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                      <li>• Confirm the correct assigned route is selected.</li>
                      <li>• Make sure the date matches the actual travel day.</li>
                      <li>• Enter total kilometers as a positive number.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Current entry preview
                    </div>
                    <div className="mt-3 grid gap-3">
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Date</span>
                        <span className="font-medium text-zinc-900">{entryDate}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Route</span>
                        <span className="font-medium text-zinc-900">
                          {selectedRoute?.routeCode ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Kilometers</span>
                        <span className="font-medium text-zinc-900">
                          {km || "0"} km
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}