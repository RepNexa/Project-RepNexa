"use client";

import { useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createRepRouteAssignment,
  patchRepRouteAssignment,
  type RepRouteAssignment,
} from "@/src/features/assignments/api";

export function AssignmentsPage() {
  const [repUsername, setRepUsername] = useState("mr@repnexa.local");
  const [routeId, setRouteId] = useState("");
  const [startDate, setStartDate] = useState("2026-01-09");
  const [endDate, setEndDate] = useState("");
  const [created, setCreated] = useState<RepRouteAssignment | null>(null);

  const [patchId, setPatchId] = useState("");
  const [patchEndDate, setPatchEndDate] = useState("");
  const [patchDisable, setPatchDisable] = useState(false);

  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await createRepRouteAssignment({
        repUsername,
        routeId: Number(routeId),
        startDate,
        endDate: endDate ? endDate : null,
      });
      setCreated(res);
      setPatchId(String(res.id));
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onPatch() {
    setBusy(true);
    setError(null);
    try {
      const res = await patchRepRouteAssignment(Number(patchId), {
        endDate: patchEndDate ? patchEndDate : undefined,
        enabled: patchDisable ? false : undefined,
      });
      setCreated(res);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 24 }}>
      <h1>Assignments</h1>

      <h2 style={{ marginTop: 24 }}>Assign rep to route</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 140px 160px 160px 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label>
          Rep username
          <input
            value={repUsername}
            onChange={(e) => setRepUsername(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Route ID
          <input
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Start date
          <input
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          End date (optional)
          <input
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <button disabled={busy} onClick={onCreate} style={{ padding: 10 }}>
          Create
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>End / disable assignment</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 160px 160px 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label>
          Assignment ID
          <input
            value={patchId}
            onChange={(e) => setPatchId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          End date (optional)
          <input
            value={patchEndDate}
            onChange={(e) => setPatchEndDate(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            paddingTop: 20,
          }}
        >
          <input
            type="checkbox"
            checked={patchDisable}
            onChange={(e) => setPatchDisable(e.target.checked)}
          />
          Disable
        </label>
        <button disabled={busy} onClick={onPatch} style={{ padding: 10 }}>
          Patch
        </button>
      </div>

      {error ? (
        <pre style={{ marginTop: 16, color: "crimson" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      ) : null}
      {created ? (
        <pre style={{ marginTop: 16 }}>{JSON.stringify(created, null, 2)}</pre>
      ) : null}
    </div>
  );
}
