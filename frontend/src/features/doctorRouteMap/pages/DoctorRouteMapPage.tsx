"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  addDoctorRoute,
  removeDoctorRoute,
} from "@/src/features/doctorRouteMap/api";
import { listDoctors, type Doctor } from "@/src/features/adminMaster/api";
import { listRoutes, type Route } from "@/src/features/adminGeo/api";

export function DoctorRouteMapPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [routeId, setRouteId] = useState<string>("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setDoctors(await listDoctors(""));
        setRoutes(await listRoutes());
      } catch (e) {
        setErr(e as ApiError);
      }
    })();
  }, []);

  async function onAdd() {
    setBusy(true);
    setErr(null);
    try {
      await addDoctorRoute({
        doctorId: Number(doctorId),
        routeId: Number(routeId),
      });
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setErr(null);
    try {
      await removeDoctorRoute({
        doctorId: Number(doctorId),
        routeId: Number(routeId),
      });
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !doctorId || !routeId;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Doctor Route mapping</h1>

      {/* Card (matches your other pages) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">Doctor</div>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            >
              <option value="">Select doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-medium text-zinc-700">Route</div>
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            >
              <option value="">Select route…</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.territoryName} / {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>

          <button
            disabled={disabled}
            onClick={onAdd}
            className={[
              "h-10 rounded-xl px-5 text-sm font-medium text-white",
              "bg-green-500 hover:bg-green-600",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "focus:outline-none focus:ring-4 focus:ring-emerald-200",
            ].join(" ")}
          >
            {busy ? "Working…" : "Add"}
          </button>

          <button
            disabled={disabled}
            onClick={onRemove}
            className={[
              "h-10 rounded-xl px-5 text-sm font-medium text-white",
              "bg-red-600 hover:bg-red-700",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "focus:outline-none focus:ring-4 focus:ring-rose-200",
            ].join(" ")}
          >
            {busy ? "Working…" : "Remove"}
          </button>
        </div>

        {err ? (
          <pre className="mt-4 rounded-xl bg-rose-50 p-4 text-xs text-rose-700 ring-1 ring-rose-200 overflow-auto">
            {JSON.stringify(err, null, 2)}
          </pre>
        ) : null}

        <p className="mt-4 text-sm text-zinc-500">
          This MVP panel is intentionally minimal: select a doctor and a route,
          then Add/Remove.
        </p>
      </div>
    </div>
  );
}