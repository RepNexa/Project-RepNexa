"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { apiFetch } from "@/src/lib/api/client";
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

type OosHistoryItem = {
  date: string;
  productCode: string;
  status: "OOS" | "LOW" | string;
  repUserId: number;
  repUsername: string;
  routeId: number;
  routeName: string;
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ChemistsPage() {
  useRegisterCsvPageExport({
    label: "Admin – Chemists",
    url: "/api/v1/admin/chemists.csv",
    fallbackFilename: "admin-chemists.csv",
  });

  const router = useRouter();

  const [rows, setRows] = useState<ChemistRow[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [q, setQ] = useState("");
  const [territory, setTerritory] = useState("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("");

  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const routeById = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes],
  );

  const territoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of routes) {
      if (!r.deleted && r.territoryName) set.add(r.territoryName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [routes]);

  async function enrichOosMetrics(chemists: Chemist[]): Promise<ChemistRow[]> {
    const today = new Date();
    const todayIso = isoDate(today);

    const df365 = new Date(today);
    df365.setDate(df365.getDate() - 365);
    const df365Iso = isoDate(df365);

    const df90 = new Date(today);
    df90.setDate(df90.getDate() - 90);
    const df90Iso = isoDate(df90);

    const LIMIT_CHEMISTS = 60;

    const first = chemists.slice(0, LIMIT_CHEMISTS);
    const rest = chemists.slice(LIMIT_CHEMISTS).map((c) => ({
      ...c,
      lastOosDate: null,
      oosCount90d: null,
    }));

    const enrichedFirst = await Promise.all(
      first.map(async (c) => {
        try {
          const qs = `?dateFrom=${encodeURIComponent(df365Iso)}&dateTo=${encodeURIComponent(todayIso)}&limit=200`;
          const items = await apiFetch<OosHistoryItem[]>(
            `/analytics/chemists/${c.id}/oos-history${qs}`,
            { method: "GET", requireCsrf: false },
          );

          const lastOos = items.find(
            (x) => String(x.status).toUpperCase() === "OOS",
          );
          const lastOosDate = lastOos?.date ?? null;

          const oosCount90d = items.filter(
            (x) =>
              String(x.status).toUpperCase() === "OOS" && x.date >= df90Iso,
          ).length;

          return { ...c, lastOosDate, oosCount90d } as ChemistRow;
        } catch {
          return { ...c, lastOosDate: null, oosCount90d: null } as ChemistRow;
        }
      }),
    );

    return [...enrichedFirst, ...rest];
  }

  async function reload() {
    setErr(null);
    try {
      const [chemists, rr] = await Promise.all([listChemists(""), listRoutes()]);
      const activeRoutes = rr.filter((r) => !r.deleted);

      setRoutes(activeRoutes);
      setRows(chemists as ChemistRow[]);

      const enriched = await enrichOosMetrics(chemists);
      setRows(enriched);
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

  const filtered = rows
    .filter((c) => !c.deleted)
    .filter((c) => {
      if (territory === "ALL") return true;
      const terr = c.territory ?? routeById.get(c.routeId)?.territoryName ?? "";
      return terr === territory;
    })
    .filter((c) => {
      const qq = q.trim().toLowerCase();
      if (!qq) return true;

      const terr = (
        c.territory ??
        routeById.get(c.routeId)?.territoryName ??
        ""
      ).toLowerCase();
      const routeCode = (routeById.get(c.routeId)?.code ?? "").toLowerCase();
      const channel = (c.channel ?? "").toLowerCase();

      return (
        (c.name ?? "").toLowerCase().includes(qq) ||
        terr.includes(qq) ||
        routeCode.includes(qq) ||
        channel.includes(qq)
      );
    });

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 md:grid-cols-[1.8fr_260px_auto] md:items-end">
          <div>
            <div className="mb-1 text-xs text-zinc-500">
              Search chemist master
            </div>
            <PillInput
              placeholder="Name, route, territory…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-zinc-500">Territory</div>
            <PillSelect
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
            >
              <option value="ALL">All territories</option>
              {territoryOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </PillSelect>
          </div>

          <div className="flex md:justify-end">
            <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
              + Add chemist
            </PrimaryButton>
          </div>
        </div>
      </Card>

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
                <th className="px-4 py-3 text-right font-medium">Edit</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => {
                const route = routeById.get(c.routeId);
                const territoryLabel = c.territory ?? route?.territoryName ?? "—";
                const statusLabel = String(c.status ?? "ACTIVE").toUpperCase();
                const isActive = statusLabel === "ACTIVE";

                return (
                  <tr key={c.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{c.name}</td>

                    <td className="px-4 py-3 text-zinc-600">
                      {route?.code ?? `#${c.routeId}`}
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {territoryLabel}
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {c.channel ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          {statusLabel}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {c.lastOosDate ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-zinc-600">
                      {c.oosCount90d == null ? "—" : String(c.oosCount90d)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-violet-700 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          router.push(`/admin/chemists/${c.id}/edit`)
                        }
                        title="Edit chemist"
                      >
                        Edit
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-rose-700 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => onDeactivate(c.id)}
                        title="Deactivate this chemist"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-zinc-500">
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