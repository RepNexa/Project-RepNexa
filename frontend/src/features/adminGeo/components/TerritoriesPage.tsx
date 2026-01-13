"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createTerritory,
  listTerritories,
  patchTerritory,
  type Territory,
} from "@/src/features/adminGeo/api";

export function TerritoriesPage() {
  const [rows, setRows] = useState<Territory[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ownerUsername, setOwnerUsername] =
    useState<string>("fm@repnexa.local");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setError(null);
    try {
      setRows(await listTerritories());
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
      await createTerritory({
        code,
        name,
        ownerUsername: ownerUsername || null,
      });
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
      await patchTerritory(id, { deleted: true });
      await reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 24 }}>
      <h1>Territories</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr 220px 120px",
          gap: 8,
          alignItems: "end",
        }}
      >
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
        <label>
          Owner (FM username)
          <input
            value={ownerUsername}
            onChange={(e) => setOwnerUsername(e.target.value)}
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
              Owner
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
          {rows.map((t) => (
            <tr key={t.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {t.id}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {t.code}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {t.name}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                {t.ownerUsername ?? "-"}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                <button
                  disabled={busy}
                  onClick={() => onDeactivate(t.id)}
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
                No territories
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
