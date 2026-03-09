"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import type { ApiError } from "@/src/lib/api/types";
import { apiFetch } from "@/src/lib/api/client";
import {
  ApiErrorBanner,
  SkeletonBox,
} from "@/src/features/hoDrilldowns/common/UiParts";
import {
  buildUrlWithParams,
  readStrParam,
} from "@/src/features/hoDrilldowns/common/url";

type VisitLogItem = {
  callId: number;
  callDate: string; // ISO date
  routeId: number;
  routeCode: string;
  routeName: string;
  repUserId: number;
  repUsername: string;
  callType: string;
  productCodes: string[];
};

type Paged<T> = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: T[];
};

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

async function fetchAllVisitLog(args: {
  doctorId: number;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<{ total: number; items: VisitLogItem[] }> {
  const size = args.pageSize ?? 200;
  const maxPages = args.maxPages ?? 5;

  const qpBase = new URLSearchParams();
  qpBase.set("size", String(size));
  if (args.dateFrom) qpBase.set("dateFrom", args.dateFrom);
  if (args.dateTo) qpBase.set("dateTo", args.dateTo);

  const first = await apiFetch<Paged<VisitLogItem>>(
    `/analytics/doctors/${args.doctorId}/visit-log?${qpBase.toString()}`,
  );

  let all = [...(first.items ?? [])];
  const totalPages = Number(first.totalPages ?? 1);

  // pull a few more pages if needed (bounded to avoid huge UI fetches)
  for (let p = 1; p < totalPages && p < maxPages; p++) {
    const qp = new URLSearchParams(qpBase.toString());
    qp.set("page", String(p));
    const next = await apiFetch<Paged<VisitLogItem>>(
      `/analytics/doctors/${args.doctorId}/visit-log?${qp.toString()}`,
    );
    all = all.concat(next.items ?? []);
  }

  return { total: Number(first.totalElements ?? all.length), items: all };
}

export function HoDoctorDetailsPage({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  const did = Number(doctorId);
  const doctorIdNum = Number.isFinite(did) ? Math.trunc(did) : NaN;

  // default window: last 90 days
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => isoDate(addDays(today, -90)), [today]);
  const defaultTo = useMemo(() => isoDate(today), [today]);

  const dateFrom = readStrParam(sp, "dateFrom") ?? defaultFrom;
  const dateTo = readStrParam(sp, "dateTo") ?? defaultTo;

  const [territory, setTerritory] = useState<string>("ALL"); // client-side filter

  const q = useQuery({
    queryKey: ["doctor-visit-log", doctorIdNum, dateFrom, dateTo],
    enabled: Number.isFinite(doctorIdNum) && doctorIdNum > 0,
    queryFn: () =>
      fetchAllVisitLog({
        doctorId: doctorIdNum,
        dateFrom,
        dateTo,
        pageSize: 250,
        maxPages: 8,
      }),
  });

  const err = q.error as ApiError | null;

  const rawItems = q.data?.items ?? [];
  const items =
    territory === "ALL"
      ? rawItems
      : rawItems.filter((x) => String(x.routeName ?? "") === territory);

  const territories = useMemo(() => {
    const set = new Set<string>();
    for (const it of rawItems) {
      const name = String(it.routeName ?? "");
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rawItems]);

  // KPIs derived from loaded items
  const totalVisits = items.length;
  const last = useMemo(() => {
    let best: VisitLogItem | null = null;
    for (const it of items) {
      if (!best) best = it;
      else if (String(it.callDate) > String(best.callDate)) best = it;
    }
    return best;
  }, [items]);

  // product promoted table derived from visit log
  const productRows = useMemo(() => {
    const m = new Map<string, { code: string; calls: number; last: string }>();
    for (const it of items) {
      const d = String(it.callDate ?? "");
      for (const p of it.productCodes ?? []) {
        const code = String(p);
        if (!code) continue;
        const cur = m.get(code);
        if (!cur) m.set(code, { code, calls: 1, last: d });
        else {
          cur.calls += 1;
          if (d > cur.last) cur.last = d;
        }
      }
    }
    return Array.from(m.values())
      .sort((a, b) => b.calls - a.calls || a.code.localeCompare(b.code))
      .slice(0, 30);
  }, [items]);

  const onDateFrom = (v: string) => {
    router.replace(
      buildUrlWithParams(`/ho/doctors/${doctorId}`, sp, {
        dateFrom: v || null,
      }),
    );
  };
  const onDateTo = (v: string) => {
    router.replace(
      buildUrlWithParams(`/ho/doctors/${doctorId}`, sp, { dateTo: v || null }),
    );
  };

  return (
    <AuthGuard allowedRoles={["FM", "CM"]}>
      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Doctor Details</h1>
          <div className="text-sm text-zinc-600">
            Drilldown view for doctor{" "}
            <span className="font-mono">#{doctorId}</span>.
          </div>
        </div>

        {/* Filter bar (v1) */}
        <div className="rounded-lg border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <div>
              <div className="text-xs text-zinc-600">Start Date</div>
              <input
                className="w-full rounded border px-2 py-1"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFrom(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-zinc-600">End Date</div>
              <input
                className="w-full rounded border px-2 py-1"
                type="date"
                value={dateTo}
                onChange={(e) => onDateTo(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-zinc-600">Territory</div>
              <select
                className="w-full rounded border px-2 py-1"
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
              >
                <option value="ALL">All territories</option>
                {territories.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {q.isFetching ? "Refreshing…" : " "}
          </div>
        </div>

        {err ? (
          <ApiErrorBanner err={err} title="Failed to load doctor visit log" />
        ) : null}
        {q.isLoading ? <SkeletonBox lines={8} /> : null}

        {!q.isLoading && !err ? (
          <>
            {/* KPI summary row */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs text-zinc-600">Doctor</div>
                <div className="mt-1 text-base font-semibold">
                  Doctor #{doctorId}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Specialty • Grade: N/A
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs text-zinc-600">
                  Total Visits (Period)
                </div>
                <div className="mt-1 text-2xl font-semibold">{totalVisits}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Derived from visit log in window.
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs text-zinc-600">Avg Visits / Month</div>
                <div className="mt-1 text-2xl font-semibold">
                  {(() => {
                    const a = new Date(dateFrom);
                    const b = new Date(dateTo);
                    const days = Math.max(
                      1,
                      Math.round((+b - +a) / 86400000) + 1,
                    );
                    const months = Math.max(1, days / 30);
                    return (totalVisits / months).toFixed(1);
                  })()}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Target: 4 / month (prototype)
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs text-zinc-600">Last Visit</div>
                <div className="mt-1 text-2xl font-semibold">
                  {last?.callDate ?? "N/A"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {last ? `By ${last.repUsername}` : " "}
                </div>
              </div>
            </div>

            {/* Two panels: Doctor Profile + Products Promoted */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-white p-4">
                <div className="font-semibold">Doctor Profile</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Basic master data (v1 shows what we can derive now).
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Territories</div>
                    <div className="text-right">
                      {territories.length ? territories.join(", ") : "N/A"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Assigned reps</div>
                    <div className="text-right">
                      {Array.from(new Set(items.map((x) => x.repUsername)))
                        .slice(0, 6)
                        .join(", ") || "N/A"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Grade</div>
                    <div className="text-right">N/A</div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Status</div>
                    <div className="text-right">N/A</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4">
                <div className="font-semibold">
                  Products Promoted to This Doctor
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Calls by product in the selected period (derived from visit
                  log).
                </div>

                <div className="mt-3 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left">
                      <tr>
                        <th className="p-2">Product</th>
                        <th className="p-2">Calls</th>
                        <th className="p-2">Last Detailed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((r) => (
                        <tr key={r.code} className="border-t">
                          <td className="p-2 font-mono">{r.code}</td>
                          <td className="p-2">{r.calls}</td>
                          <td className="p-2">{r.last || "N/A"}</td>
                        </tr>
                      ))}
                      {productRows.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-2 text-zinc-600" colSpan={3}>
                            No product detailing found in this window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Visit Log */}
            <div className="mt-4 rounded-lg border bg-white p-4">
              <div className="font-semibold">Visit Log – This Doctor</div>
              <div className="mt-1 text-sm text-zinc-600">
                All visits to this doctor in the selected period (newest-first
                if backend orders it).
              </div>

              <div className="mt-3 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Rep</th>
                      <th className="p-2">Territory</th>
                      <th className="p-2">Products Detailed</th>
                      <th className="p-2">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .slice()
                      .sort((a, b) =>
                        String(b.callDate).localeCompare(String(a.callDate)),
                      )
                      .slice(0, 80)
                      .map((it) => (
                        <tr key={it.callId} className="border-t">
                          <td className="p-2">{it.callDate}</td>
                          <td className="p-2">{it.repUsername}</td>
                          <td className="p-2">{it.routeName}</td>
                          <td className="p-2">
                            {(it.productCodes ?? []).join(", ") || "—"}
                          </td>
                          <td className="p-2 text-zinc-500">—</td>
                        </tr>
                      ))}
                    {items.length === 0 ? (
                      <tr className="border-t">
                        <td className="p-2 text-zinc-600" colSpan={5}>
                          No visits in this window.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                Showing up to 80 rows. Total loaded rows: {items.length}.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AuthGuard>
  );
}
