"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import { repContext, type RepContext } from "@/src/features/shared/api/repApi";
import { createMileageEntry } from "@/src/features/repExpense/api";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ExpensePage() {
  const [ctx, setCtx] = useState<RepContext | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [okId, setOkId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [repRouteAssignmentId, setRra] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState<string>(todayISO());
  const [km, setKm] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const c = await repContext();
        setCtx(c);
        if (c.routes.length > 0) setRra(c.routes[0].repRouteAssignmentId);
      } catch (e) {
        setErr(e as ApiError);
      }
    })();
  }, []);

  const routes = useMemo(() => ctx?.routes ?? [], [ctx]);

  async function onSubmit() {
    setErr(null);
    setOkId(null);

    if (!repRouteAssignmentId) {
      setErr({
        timestamp: new Date().toISOString(),
        status: 400,
        error: "Bad Request",
        code: "VALIDATION_ERROR",
        message: "Route selection is required",
        path: "/rep/expense",
      });
      return;
    }

    const kmNum = Number(km);
    if (!Number.isFinite(kmNum) || kmNum <= 0) {
      setErr({
        timestamp: new Date().toISOString(),
        status: 400,
        error: "Bad Request",
        code: "VALIDATION_ERROR",
        message: "km must be > 0",
        path: "/rep/expense",
        fieldErrors: [{ field: "km", message: "km must be > 0" }],
      });
      return;
    }

    setBusy(true);
    try {
      const res = await createMileageEntry({
        repRouteAssignmentId,
        entryDate,
        km: kmNum,
      });
      setOkId(res.id);
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 24 }}>
      <h1>Expenses — Mileage</h1>

      {okId ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #cfe8cf",
            background: "#f5fff5",
            borderRadius: 8,
          }}
        >
          Saved mileage entry. ID: <b>{okId}</b>
        </div>
      ) : null}

      {err ? (
        <pre
          style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}
        >
          {JSON.stringify(err, null, 2)}
        </pre>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px 200px",
          gap: 16,
          marginTop: 16,
          alignItems: "end",
        }}
      >
        <label>
          Route
          <select
            value={repRouteAssignmentId ?? ""}
            onChange={(e) => setRra(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          >
            {routes.map((r) => (
              <option
                key={r.repRouteAssignmentId}
                value={r.repRouteAssignmentId}
              >
                {r.territoryName} / {r.routeName} ({r.routeCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>

        <label>
          KM
          <input
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="e.g., 12.5"
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        style={{ marginTop: 16, padding: "10px 14px" }}
      >
        Submit mileage
      </button>
    </div>
  );
}
