"use client";

import AppShell from "../../../_components/AppShell";
import RequireRole from "../../../_components/RequireRole";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api/client";
import type { ApiError } from "../../../../lib/api/types";

function fmtErr(e: unknown): string {
  const x = e as ApiError;
  if (x && typeof x.status === "number" && typeof x.code === "string") {
    return `${x.status} ${x.code}: ${x.message}`;
  }
  return "Request failed";
}

export default function DcrDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await apiFetch<any>(`/rep/dcr-submissions/${id}`, {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setData(d);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setData(null);
        setErr(fmtErr(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <AppShell title={`MR – DCR Details #${id}`}>
      <RequireRole role="MR">
        {err ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {data ? (
          <pre className="mt-3 overflow-auto rounded border bg-white p-4 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-zinc-600">Loading…</div>
        )}
      </RequireRole>
    </AppShell>
  );
}
