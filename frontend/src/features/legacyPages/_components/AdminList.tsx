"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/src/lib/api/client";
import type { ApiError } from "@/src/lib/api/types";

function formatErr(e: unknown): string {
  const x = e as ApiError;
  if (x && typeof x.status === "number" && typeof x.code === "string") {
    return `${x.status} ${x.code}: ${x.message}`;
  }
  return "Request failed";
}

export default function AdminList({
  title,
  endpoint,
}: {
  title: string;
  endpoint: string;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<any[]>(endpoint, {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setRows(null);
        setErr(formatErr(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  const columns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const keys = new Set<string>();
    for (const r of rows.slice(0, 20)) {
      Object.keys(r ?? {}).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [rows]);

  return (
    <div className="rounded border bg-white p-4">
      <div className="mb-2 font-medium">{title}</div>

      {err ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      {rows && rows.length === 0 ? (
        <div className="text-sm text-zinc-600">No rows returned.</div>
      ) : null}

      {rows && rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((c) => (
                  <th key={c} className="px-2 py-2 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-b align-top">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-2 font-mono text-xs">
                      {typeof r?.[c] === "object"
                        ? JSON.stringify(r?.[c])
                        : String(r?.[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm underline">
              Raw JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-2 text-xs">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
