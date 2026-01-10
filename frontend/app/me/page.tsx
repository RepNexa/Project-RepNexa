"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import type { MeResponse } from "@/src/features/auth/api";
import { me } from "@/src/features/auth/api";
import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function MePage() {
  return (
    <AuthGuard>
      <MeInner />
    </AuthGuard>
  );
}

function MeInner() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await me();
        setData(d);
      } catch (e) {
        setErr(e as ApiError);
      }
    })();
  }, []);

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 24 }}>
      <h1>/me</h1>
      {err ? (
        <pre style={{ color: "crimson" }}>{JSON.stringify(err, null, 2)}</pre>
      ) : null}
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <div>Loading…</div>}
    </div>
  );
}
