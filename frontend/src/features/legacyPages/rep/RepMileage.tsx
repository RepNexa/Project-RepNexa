"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import AppShell from "../_components/AppShell";
import RequireRole from "../_components/RequireRole";

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

  // If opened with ?rraId=..., prefer that.
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
        // Backend DTO name not provided here; tolerate both `routes` and `assignedRoutes`
        const ctx = await apiFetch<any>("/rep/context", { method: "GET" });
        const list: AssignedRoute[] = (ctx?.routes ??
          ctx?.assignedRoutes ??
          []) as AssignedRoute[];

        if (cancelled) return;

        setRoutes(Array.isArray(list) ? list : []);

        // Select route:
        // 1) query rraId if it matches
        // 2) otherwise first route
        const match = Array.isArray(list)
          ? list.find((r) => r.repRouteAssignmentId === rraFromQuery)
          : undefined;
        if (match) setSelectedRraId(match.repRouteAssignmentId);
        else if (Array.isArray(list) && list.length > 0)
          setSelectedRraId(list[0].repRouteAssignmentId);
        else setSelectedRraId(0);
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

  async function submit() {
    setBusy(true);
    setCreatedId(null);
    setErr(null);
    try {
      if (!selectedRraId) {
        throw new Error(
          "No assigned route selected. Create/enable an MR route assignment first.",
        );
      }

      const body = {
        repRouteAssignmentId: selectedRraId,
        entryDate,
        km: Number(km),
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

  const selectedRoute =
    routes.find((r) => r.repRouteAssignmentId === selectedRraId) ?? null;

  return (
    <AppShell title="Rep (MR) – Mileage">
      <RequireRole role="MR">
        <div className="max-w-xl rounded border bg-white p-4">
          <div className="text-sm text-zinc-700">
            Submit your daily mileage against an assigned route.
          </div>

          <div className="mt-4">
            <label className="text-sm">Assigned route</label>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
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

            {!loadingCtx && routes.length === 0 ? (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
                No active assignments for this MR. To demo submissions,
                create/enable an MR route assignment (CM/FM) and refresh this
                page.
              </div>
            ) : null}

            {selectedRoute ? (
              <div className="mt-2 text-xs text-zinc-600">
                Using RepRouteAssignmentId:{" "}
                <b>{selectedRoute.repRouteAssignmentId}</b>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="text-sm">Entry date</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="text-sm">Kilometers (km)</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              inputMode="decimal"
            />
          </div>

          {createdId ? (
            <div className="mt-4 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
              Mileage submitted successfully. Entry ID: <b>{createdId}</b>
            </div>
          ) : null}

          {err ? (
            <div className="mt-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <button
            disabled={busy || loadingCtx || !selectedRraId}
            onClick={submit}
            className="mt-5 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit Mileage"}
          </button>
        </div>
      </RequireRole>
    </AppShell>
  );
}
