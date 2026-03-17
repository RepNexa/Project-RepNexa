"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createChemist,
  listChemists,
  listRoutes,
  patchChemist,
  type Chemist,
  type Route,
} from "@/src/features/adminMaster/api";
import { useRegisterCsvPageExport } from "@/src/features/shared/exports/useCsvPageExport";

type ChemistRow = Chemist & {
  territory?: string | null;
  channel?: string | null;
  status?: string | null;
  lastOosDate?: string | null;
  oosCount90d?: number | null;
};

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

function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  },
) {
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

function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  },
) {
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

export default function ChemistsPage() {
  useRegisterCsvPageExport({
    label: "Admin – Chemists",
    url: "/api/v1/admin/chemists.csv",
    fallbackFilename: "admin-chemists.csv",
  });
  const [rows, setRows] = useState<Chemist[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [q, setQ] = useState("");
  const [territory, setTerritory] = useState("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");

  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setErr(null);
    try {
      const [chemists, rr] = await Promise.all([
        listChemists(""),
        listRoutes(),
      ]);
      setRows(chemists);
      setRoutes(rr.filter((r) => !r.deleted));
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
      setRouteId("");
      setAddOpen(false);
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: number) {
    if (!confirm("Deactivate this item? It will be hidden from dashboards."))
      return;
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

  const filtered = (rows as ChemistRow[])
    .filter((c) => !c.deleted)
    .filter((c) => {
      const qq = q.trim().toLowerCase();
      if (!qq) return true;
      return (c.name ?? "").toLowerCase().includes(qq);
    });

  const routeById = new Map(routes.map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="grid gap-4 md:grid-cols-[1.8fr_260px_auto] md:items-end">
          <div>
            <div className="mb-1 text-xs text-zinc-500">
              Search chemist master
            </div>
            <PillInput
              placeholder="Name, territory…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Territory</div>
            <PillSelect
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              disabled
            >
              <option value="ALL">All territories</option>
            </PillSelect>
          </div>
          <div className="flex md:justify-end">
            <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
              + Add chemist
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Add panel */}
      {addOpen ? (
        <Card className="max-w-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-semibold">Add chemist</div>
              <div className="text-sm text-zinc-500">
                Maintain chemist master used for stock-out and coverage
                analytics.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Chemist name</div>
              <PillInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pharmacy name"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Route</div>
              <PillSelect
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
              >
                <option value="">Select a route…</option>
                {routes.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.code} — {r.name} ({r.territoryCode})
                  </option>
                ))}
              </PillSelect>
            </div>
            <div className="md:col-span-2 text-xs text-zinc-500">
              Territory/channel/status/notes remain prototype-only for now.
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={busy || !name.trim() || !routeId.trim()}
              onClick={onCreate}
            >
              Save chemist
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {/* Table */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">Master – Chemists</div>
            <div className="text-sm text-zinc-500">
              All chemists that reps can select in DCR / chemist reports.
            </div>
          </div>
          <div className="text-sm text-zinc-400">Sample data</div>
        </div>

        {err ? (
          <pre className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {JSON.stringify(err, null, 2)}
          </pre>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Chemist</th>
                <th className="px-4 py-3 text-left font-medium">Route</th>
                <th className="px-4 py-3 text-left font-medium">Territory</th>
                <th className="px-4 py-3 text-left font-medium">Channel</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">
                  Last OOS Date
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  OOS Count (90d)
                </th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {routeById.get((c as any).routeId)?.code ??
                      `#${(c as any).routeId}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      disabled={busy}
                      onClick={() => onDeactivate(c.id)}
                      title="Deactivate (MVP placeholder for Edit)"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-zinc-500">
                    No chemists
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
