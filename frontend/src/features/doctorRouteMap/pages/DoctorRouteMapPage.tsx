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

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 24 }}>
      <h1>Doctor ↔ Route mapping</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 120px 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label>
          Doctor
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="">Select doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Route
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
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
          disabled={busy || !doctorId || !routeId}
          onClick={onAdd}
          style={{ padding: 10 }}
        >
          Add
        </button>
        <button
          disabled={busy || !doctorId || !routeId}
          onClick={onRemove}
          style={{ padding: 10 }}
        >
          Remove
        </button>
      </div>

      {err ? (
        <pre style={{ marginTop: 16, color: "crimson" }}>
          {JSON.stringify(err, null, 2)}
        </pre>
      ) : null}
      <p style={{ marginTop: 16, opacity: 0.8 }}>
        This MVP panel is intentionally minimal: select a doctor and a route,
        then Add/Remove.
      </p>
    </div>
  );
}
