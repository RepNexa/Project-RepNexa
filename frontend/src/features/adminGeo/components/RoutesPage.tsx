"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createRoute,
  listRoutes,
  patchRoute,
  type Route,
} from "@/src/features/adminGeo/api";

export function RoutesPage() {
  const [rows, setRows] = useState<Route[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [territoryId, setTerritoryId] = useState<string>("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setError(null);
    try {
      setRows(await listRoutes());
    } catch (e) {
      setError(e as ApiError);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      await createRoute({ territoryId: Number(territoryId), code, name });
      setCode("");
      setName("");
      await reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: number) {
    setBusy(true);
    setError(null);
    try {
      await patchRoute(id, { deleted: true });
      await reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 24 }}>
      <h1>Routes</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "160px 140px 1fr 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label>
          Territory ID
          <input
            value={territoryId}
            onChange={(e) => setTerritoryId(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <button disabled={busy} onClick={onCreate} style={{ padding: 10 }}>
          Create
        </button>
      </div>

      {error ? (
        <pre style={{ marginTop: 16, color: "crimson" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      ) : null}

      <table
        style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              ID
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Code
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Name
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Territory
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {r.id}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {r.code}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {r.name}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {r.territoryName} ({r.territoryCode}) — ID {r.territoryId}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                <button
                  disabled={busy}
                  onClick={() => onDeactivate(r.id)}
                  style={{ padding: "6px 10px" }}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 8, opacity: 0.7 }}>
                No routes
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
