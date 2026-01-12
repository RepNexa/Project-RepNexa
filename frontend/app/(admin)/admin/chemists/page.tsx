"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createChemist,
  listChemists,
  patchChemist,
  type Chemist,
} from "@/src/features/adminMaster/api";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["CM"]}>
      <ChemistsPage />
    </AuthGuard>
  );
}

function ChemistsPage() {
  const [rows, setRows] = useState<Chemist[]>([]);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setErr(null);
    try {
      setRows(await listChemists(""));
    } catch (e) {
      setErr(e as ApiError);
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      await createChemist({ routeId: Number(routeId), name });
      setName("");
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: number) {
    setBusy(true);
    setErr(null);
    try {
      await patchChemist(id, { deleted: true });
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 24 }}>
      <h1>Chemists</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "160px 1fr 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
        <label>
          Route ID
          <input
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
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

      {err ? (
        <pre style={{ marginTop: 16, color: "crimson" }}>
          {JSON.stringify(err, null, 2)}
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
              Name
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #ddd",
                padding: 8,
              }}
            >
              Route ID
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
          {rows.map((c) => (
            <tr key={c.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {c.id}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {c.name}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {c.routeId}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                <button
                  disabled={busy}
                  onClick={() => onDeactivate(c.id)}
                  style={{ padding: "6px 10px" }}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>
                No chemists
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
