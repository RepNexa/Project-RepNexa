"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import {
  listChemists,
  listRoutes,
  patchChemist,
  type Chemist,
  type Route,
} from "@/src/features/adminMaster/api";

type ChemistRow = Chemist & {
  lastOosDate?: string | null;
  oosCount90d?: number | null;
};

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function PillInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-10 w-full rounded-full border border-zinc-200 bg-white px-4 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function PillSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-10 w-full appearance-none rounded-full border border-zinc-200 bg-white px-4 pr-9 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "h-10 rounded-full bg-violet-600 px-5 text-sm font-medium text-white shadow-sm",
        "hover:bg-violet-700 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "h-10 rounded-full border border-zinc-200 bg-white px-5 text-sm",
        "hover:bg-zinc-50 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

export default function ChemistEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const chemistId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  const [chemist, setChemist] = useState<ChemistRow | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);

  const [name, setName] = useState("");
  const [routeId, setRouteId] = useState<string>("");

  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  const territoryName = useMemo(() => {
    const rid = Number(routeId);
    return routeById.get(rid)?.territoryName ?? "—";
  }, [routeId, routeById]);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const [allChemists, rr] = await Promise.all([listChemists(""), listRoutes()]);
        const activeRoutes = rr.filter((r) => !r.deleted);

        setRoutes(activeRoutes);

        const found = (allChemists as ChemistRow[]).find((c) => c.id === chemistId) ?? null;
        if (!found) {
          setChemist(null);
          setErr({ code: "CHEMIST_NOT_FOUND", message: "Chemist not found", status: 404 } as any);
          return;
        }

        setChemist(found);
        setName(found.name ?? "");
        setRouteId(String(found.routeId ?? ""));
      } catch (e) {
        setErr(e as ApiError);
      } finally {
        setLoading(false);
      }
    })();
  }, [chemistId]);

  async function onSave() {
    if (!name.trim()) {
      setErr({ code: "VALIDATION_ERROR", message: "Name is required" } as any);
      return;
    }
    if (!routeId.trim()) {
      setErr({ code: "VALIDATION_ERROR", message: "Route is required" } as any);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      // ✅ update name and route
      await patchChemist(chemistId, {
        name: name.trim(),
        routeId: Number(routeId),
      });

      router.push("/admin/chemists");
      router.refresh();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">Edit Chemist</div>
            <div className="text-sm text-zinc-500">Update chemist master data.</div>
          </div>

          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => router.push("/admin/chemists")} disabled={busy}>
              Back
            </SecondaryButton>
            <PrimaryButton type="button" onClick={onSave} disabled={busy || loading}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>

        {err ? (
          <pre className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {JSON.stringify(err, null, 2)}
          </pre>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-zinc-500">Loading…</div>
        ) : chemist ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Chemist name</div>
              <PillInput value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-xs text-zinc-500">Route</div>
              <PillSelect value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                <option value="">Select a route…</option>
                {routes.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.code} — {r.name} ({r.territoryCode})
                  </option>
                ))}
              </PillSelect>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-xs text-zinc-500">Territory (derived from route)</div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                {territoryName}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Territory is derived from the selected route.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-500">Chemist not found.</div>
        )}
      </Card>
    </div>
  );
}