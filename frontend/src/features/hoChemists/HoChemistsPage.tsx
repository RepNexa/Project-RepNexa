"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/src/lib/api/types";
import { SimpleTypeahead } from "@/src/features/shared/components/SimpleTypeahead";
import { DrilldownFilterBar } from "@/src/features/hoDrilldowns/common/FilterBar";
import {
  ApiErrorBanner,
  EmptyCard,
  RawJson,
  SkeletonBox,
} from "@/src/features/hoDrilldowns/common/UiParts";
import {
  normalizeDrilldownFilters,
  stableStringify,
  effectiveDateRange,
  isoWeekKey,
  type DrilldownFilters,
  type DrilldownPeriod,
} from "@/src/features/hoDrilldowns/common/types";
import {
  buildUrlWithParams,
  readIntParam,
  readStrParam,
} from "@/src/features/hoDrilldowns/common/url";
import { useCachedTypeahead } from "@/src/features/hoDrilldowns/common/typeahead";
import { chemistDetails, chemistVisitLog, lookupChemists } from "./api";
import {
  MiniHBarChart,
  MiniLineChart,
} from "@/src/features/hoDrilldowns/common/MiniCharts";

function isApiError(e: any): e is ApiError {
  return (
    e &&
    typeof e === "object" &&
    typeof e.status === "number" &&
    typeof e.code === "string"
  );
}

function parsePeriod(v: string | undefined): DrilldownPeriod {
  if (v === "THIS_MONTH" || v === "LAST_MONTH" || v === "CUSTOM") return v;
  return "THIS_MONTH";
}

function pickStr(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function pickNum(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function toIsoDateOrNull(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

function daysBetweenInclusive(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  const ms = +db - +da;
  if (!Number.isFinite(ms)) return 1;
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

async function fetchAllChemistVisitLog(args: {
  chemistId: number;
  dateFrom: string;
  dateTo: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<{ total: number; items: any[] }> {
  const size = Math.min(args.pageSize ?? 50, 50);
  const maxPages = args.maxPages ?? 10;

  const first = await chemistVisitLog({
    chemistId: args.chemistId,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    page: 0,
    size,
  });

  let all = Array.isArray(first?.items) ? [...first.items] : [];
  const totalPages =
    typeof first?.totalPages === "number" ? Number(first.totalPages) : 1;

  for (let p = 1; p < totalPages && p < maxPages; p++) {
    const next = await chemistVisitLog({
      chemistId: args.chemistId,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      page: p,
      size,
    });
    all = all.concat(Array.isArray(next?.items) ? next.items : []);
  }

  const totalElements =
    typeof first?.totalElements === "number"
      ? Number(first.totalElements)
      : all.length;

  return { total: totalElements, items: all };
}

export function HoChemistsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const chemistId = readIntParam(sp, "chemistId");
  const period = parsePeriod(sp.get("period") ?? undefined);
  const dateFrom = readStrParam(sp, "dateFrom");
  const dateTo = readStrParam(sp, "dateTo");

  const rawFilters = React.useMemo<DrilldownFilters>(
    () => ({ period, dateFrom, dateTo }),
    [period, dateFrom, dateTo],
  );
  const filters = React.useMemo(
    () => normalizeDrilldownFilters(rawFilters),
    [rawFilters],
  );
  const range = React.useMemo(
    () => effectiveDateRange(filters),
    [filters.period, filters.dateFrom, filters.dateTo],
  );
  const [notFoundMsg, setNotFoundMsg] = React.useState<string | null>(null);
  const [repFilter, setRepFilter] = React.useState<string>("ALL");
  const [productFilter, setProductFilter] = React.useState<string>("ALL");

  const detailsQ = useQuery({
    queryKey: [
      "hoChemistDetails",
      chemistId ?? "none",
      stableStringify(filters),
    ],
    queryFn: () => chemistDetails(chemistId as number, filters),
    enabled: typeof chemistId === "number" && chemistId > 0,
    staleTime: 120_000,
  });

  React.useEffect(() => {
    if (!chemistId) return;
    const err = detailsQ.error as any;
    if (isApiError(err) && err.status === 404) {
      setNotFoundMsg(`Chemist not found (id=${chemistId}).`);
      router.replace(buildUrlWithParams(pathname, sp, { chemistId: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsQ.error]);

  const logQ = useQuery({
    queryKey: [
      "hoChemistVisitLogAll",
      chemistId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
      repFilter,
      productFilter,
    ],
    enabled: typeof chemistId === "number" && chemistId > 0 && !!range,
    queryFn: () =>
      fetchAllChemistVisitLog({
        chemistId: chemistId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
        pageSize: 50,
        maxPages: 10,
      }),
    staleTime: 60_000,
  });

  const { fetchOptions, lastErr: lookupErr } = useCachedTypeahead({
    keyPrefix: ["hoLookup", "chemists"],
    fetcher: lookupChemists,
    map: (c: any) => ({
      key: String(c.id),
      label: `${String(c.name ?? c.code ?? "Chemist")} (ID ${c.id})`,
      value: Number(c.id),
    }),
    staleTimeMs: 120_000,
  });

  const onSelect = (id: number) => {
    setNotFoundMsg(null);
    setRepFilter("ALL");
    setProductFilter("ALL");
    router.replace(buildUrlWithParams(pathname, sp, { chemistId: id }));
  };

  const onFilters = (next: DrilldownFilters) => {
    setNotFoundMsg(null);
    setRepFilter("ALL");
    setProductFilter("ALL");
    router.replace(
      buildUrlWithParams(pathname, sp, {
        period: next.period,
        // Don't keep CUSTOM dates when switching back to THIS_MONTH/LAST_MONTH.
        dateFrom: next.period === "CUSTOM" ? (next.dateFrom ?? null) : null,
        dateTo: next.period === "CUSTOM" ? (next.dateTo ?? null) : null,
      }),
    );
  };

  const err: ApiError | null =
    (detailsQ.error as any) || (logQ.error as any) || null;
  const chemistObj = detailsQ.data?.chemist ?? null;
  const chemistName =
    pickStr(chemistObj, ["name", "code"]) ??
    (chemistId ? `Chemist #${chemistId}` : "Chemist");
  const totalVisits =
    typeof detailsQ.data?.visitCount === "number"
      ? detailsQ.data.visitCount
      : null;
  const oosByProduct: Array<{ key: string; count: number }> = Array.isArray(
    detailsQ.data?.oosByProduct,
  )
    ? detailsQ.data.oosByProduct
    : [];
  const lowByProduct: Array<{ key: string; count: number }> = Array.isArray(
    detailsQ.data?.lowByProduct,
  )
    ? detailsQ.data.lowByProduct
    : [];
  const oosCount = oosByProduct.reduce((a, x) => a + Number(x.count ?? 0), 0);
  const lowCount = lowByProduct.reduce((a, x) => a + Number(x.count ?? 0), 0);

  const allVisitItems = React.useMemo(
    () => logQ.data?.items ?? [],
    [logQ.data],
  );
  const reps = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of allVisitItems) {
      const u = pickStr(it, ["repUsername", "rep_username", "rep"]) ?? "";
      if (u) set.add(u);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allVisitItems]);

  const allProducts = React.useMemo(() => {
    const set = new Set<string>();
    // from detail aggregates
    for (const p of oosByProduct) if (p?.key) set.add(String(p.key));
    for (const p of lowByProduct) if (p?.key) set.add(String(p.key));
    // from visit log arrays
    for (const it of allVisitItems) {
      for (const p of (it?.oosProductCodes ?? []) as any[]) {
        const s = String(p ?? "").trim();
        if (s) set.add(s);
      }
      for (const p of (it?.lowProductCodes ?? []) as any[]) {
        const s = String(p ?? "").trim();
        if (s) set.add(s);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allVisitItems, oosByProduct, lowByProduct]);

  const visitItems = React.useMemo(() => {
    let xs = allVisitItems;
    if (repFilter !== "ALL") {
      xs = xs.filter(
        (it: any) =>
          (pickStr(it, ["repUsername", "rep_username", "rep"]) ?? "") ===
          repFilter,
      );
    }
    if (productFilter !== "ALL") {
      xs = xs.filter((it: any) => {
        const oos = (it?.oosProductCodes ?? []).map(String);
        const low = (it?.lowProductCodes ?? []).map(String);
        return oos.includes(productFilter) || low.includes(productFilter);
      });
    }
    return xs;
  }, [allVisitItems, repFilter, productFilter]);

  const visitTrend = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of visitItems) {
      const d = toIsoDateOrNull(pickStr(it, ["visitDate", "visit_date"]));
      if (!d) continue;
      const k = isoWeekKey(d);
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([x, y]) => ({ x, y }));
  }, [visitItems]);

  const oosHistoryRows = React.useMemo(() => {
    const rows: Array<{
      date: string;
      product: string;
      rep: string;
      status: "OOS" | "LOW";
    }> = [];

    for (const it of visitItems) {
      const date =
        toIsoDateOrNull(pickStr(it, ["visitDate", "visit_date"])) ?? "";
      const rep = pickStr(it, ["repUsername", "rep_username", "rep"]) ?? "—";

      for (const p of (it?.oosProductCodes ?? []) as any[]) {
        const code = String(p ?? "").trim();
        if (!code) continue;
        rows.push({ date, product: code, rep, status: "OOS" });
      }
      for (const p of (it?.lowProductCodes ?? []) as any[]) {
        const code = String(p ?? "").trim();
        if (!code) continue;
        rows.push({ date, product: code, rep, status: "LOW" });
      }
    }

    return rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.product.localeCompare(b.product),
    );
  }, [visitItems]);

  const lastVisitDate = React.useMemo(() => {
    let best: string | null = null;
    for (const it of visitItems) {
      const d = toIsoDateOrNull(pickStr(it, ["visitDate", "visit_date"]));
      if (!d) continue;
      if (!best || d > best) best = d;
    }
    return best;
  }, [visitItems]);

  const lastOosDate = React.useMemo(() => {
    const r = oosHistoryRows.find((x) => x.status === "OOS");
    return r?.date ?? null;
  }, [oosHistoryRows]);

  const avgPerMonth = React.useMemo(() => {
    const df = range?.dateFrom ?? "";
    const dt = range?.dateTo ?? "";
    if (!df || !dt) return null;
    const days = daysBetweenInclusive(df, dt);
    const months = Math.max(1, days / 30);
    const v = (Number(totalVisits ?? 0) / months).toFixed(1);
    return v;
  }, [range?.dateFrom, range?.dateTo, totalVisits]);

  const oosChartRows = React.useMemo(
    () =>
      oosByProduct
        .map((p) => ({ label: String(p.key), value: Number(p.count ?? 0) }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
        .slice(0, 8),
    [oosByProduct],
  );

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Chemists</h1>
          <div className="text-sm text-zinc-600">
            Search and drill into chemist analytics (Milestone 7). Backend scope
            applies.
          </div>
        </div>
        <Link
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
          href="/ho"
        >
          Back
        </Link>
      </div>

      {err && <ApiErrorBanner err={err} />}
      {notFoundMsg ? <EmptyCard title={notFoundMsg} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium">Search</div>
          <SimpleTypeahead<number>
            label="Chemist"
            placeholder="Type a name…"
            fetchOptions={fetchOptions}
            onSelect={(opt) => onSelect(opt.value)}
          />
          {lookupErr ? (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Lookup unavailable:{" "}
              <span className="font-mono">{lookupErr.status}</span>{" "}
              <span className="font-mono">{lookupErr.code}</span>. Use the ID
              input below.
            </div>
          ) : null}
          <div className="mt-3">
            <div className="text-xs text-zinc-600">Or enter Chemist ID</div>
            <input
              className="mt-1 h-10 w-full rounded border px-2"
              type="number"
              min={1}
              value={chemistId ?? ""}
              placeholder="e.g. 9"
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                router.replace(
                  buildUrlWithParams(pathname, sp, { chemistId: v ?? null }),
                );
              }}
            />
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium">Filters</div>
          <DrilldownFilterBar
            value={rawFilters}
            onChange={onFilters}
            isFetching={detailsQ.isFetching}
          />
        </div>
      </div>

      <div className="mt-4 rounded border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Chemist drilldown</div>
        {detailsQ.isLoading ? (
          <SkeletonBox lines={7} />
        ) : !chemistId ? (
          <EmptyCard
            title="No chemist selected"
            body="Use the search box or enter a chemist ID."
          />
        ) : detailsQ.error ? (
          isApiError(detailsQ.error) ? (
            <ApiErrorBanner err={detailsQ.error} />
          ) : (
            <EmptyCard title="Failed to load details" />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Chemist</div>
                <div className="mt-1 text-2xl font-semibold">{chemistName}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  ID <span className="font-mono">#{chemistId}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Visits (period)</div>
                <div className="mt-1 text-3xl font-semibold">
                  {totalVisits ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  From chemist-details.visitCount.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">OOS events (period)</div>
                <div className="mt-1 text-3xl font-semibold">{oosCount}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Derived from oosByProduct counts.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">LOW stock (period)</div>
                <div className="mt-1 text-3xl font-semibold">{lowCount}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Derived from lowByProduct counts.
                </div>
              </div>
            </div>

            {/* Filter dropdowns (prototype intent: rep/product scope) */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Chemist Profile</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Best-effort from current backend response.
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Route ID</div>
                    <div className="text-right">
                      {pickNum(chemistObj, ["routeId", "route_id"]) ?? "—"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Avg visits / month</div>
                    <div className="text-right">{avgPerMonth ?? "—"}</div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Last visit</div>
                    <div className="text-right">{lastVisitDate ?? "—"}</div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Last OOS date</div>
                    <div className="text-right">{lastOosDate ?? "—"}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">OOS by Product</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Top products with OOS flags in the selected period.
                </div>
                <div className="mt-3">
                  {oosChartRows.length === 0 ? (
                    <EmptyCard title="No OOS flags in window" />
                  ) : (
                    <MiniHBarChart rows={oosChartRows} maxRows={8} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium">Rep</div>
                <select
                  className="mt-2 h-10 w-full rounded border px-2"
                  value={repFilter}
                  onChange={(e) => setRepFilter(e.target.value)}
                >
                  <option value="ALL">All reps</option>
                  {reps.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium">Product</div>
                <select
                  className="mt-2 h-10 w-full rounded border px-2"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  <option value="ALL">All products</option>
                  {allProducts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">
                  Visits to This Chemist Over Time
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Weekly chemist visit trend (filtered by rep/product if set).
                </div>
                <div className="mt-3">
                  {logQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : logQ.error ? (
                    isApiError(logQ.error) ? (
                      <ApiErrorBanner err={logQ.error} />
                    ) : (
                      <EmptyCard title="Visit trend unavailable" />
                    )
                  ) : visitTrend.length === 0 ? (
                    <EmptyCard title="No visits in window" />
                  ) : (
                    <MiniLineChart points={visitTrend} />
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">
                  Stock-Out History – This Chemist
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  OOS/LOW events by product (derived from visit log).
                </div>
                <div className="mt-3 overflow-x-auto rounded border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="px-2 py-2 text-left">Date</th>
                        <th className="px-2 py-2 text-left">Product</th>
                        <th className="px-2 py-2 text-left">Rep</th>
                        <th className="px-2 py-2 text-left">Status</th>
                        <th className="px-2 py-2 text-left">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {oosHistoryRows.slice(0, 40).map((r, idx) => (
                        <tr key={`${r.date}-${r.product}-${r.status}-${idx}`}>
                          <td className="px-2 py-2">{r.date || "—"}</td>
                          <td className="px-2 py-2 font-mono">{r.product}</td>
                          <td className="px-2 py-2">{r.rep}</td>
                          <td className="px-2 py-2">{r.status}</td>
                          <td className="px-2 py-2 text-zinc-500">—</td>
                        </tr>
                      ))}
                      {oosHistoryRows.length === 0 ? (
                        <tr>
                          <td className="px-2 py-3 text-zinc-600" colSpan={5}>
                            No OOS/LOW events in this window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="font-semibold">
                Recent Visits & Notes – This Chemist
              </div>
              <div className="mt-1 text-sm text-zinc-600">
                Visit log (filtered by rep/product if set). Notes are not yet
                available in this dataset.
              </div>
              <div className="mt-3 overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-700">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Rep</th>
                      <th className="px-2 py-2 text-left">Territory</th>
                      <th className="px-2 py-2 text-left">OOS Products</th>
                      <th className="px-2 py-2 text-left">LOW Products</th>
                      <th className="px-2 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visitItems
                      .slice()
                      .sort((a: any, b: any) => {
                        const ad =
                          toIsoDateOrNull(
                            pickStr(a, ["visitDate", "visit_date"]),
                          ) ?? "";
                        const bd =
                          toIsoDateOrNull(
                            pickStr(b, ["visitDate", "visit_date"]),
                          ) ?? "";
                        return bd.localeCompare(ad);
                      })
                      .slice(0, 50)
                      .map((it: any, idx: number) => {
                        const d =
                          toIsoDateOrNull(
                            pickStr(it, ["visitDate", "visit_date"]),
                          ) ?? "—";
                        const rep =
                          pickStr(it, ["repUsername", "rep_username", "rep"]) ??
                          "—";
                        const terr =
                          pickStr(it, ["routeName", "routeCode"]) ?? "—";
                        const oos = (it?.oosProductCodes ?? [])
                          .map(String)
                          .filter(Boolean)
                          .join(", ");
                        const low = (it?.lowProductCodes ?? [])
                          .map(String)
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <tr
                            key={String(
                              pickNum(it, ["visitId", "visit_id"]) ?? idx,
                            )}
                          >
                            <td className="px-2 py-2">{d}</td>
                            <td className="px-2 py-2">{rep}</td>
                            <td className="px-2 py-2">{terr}</td>
                            <td className="px-2 py-2">{oos || "—"}</td>
                            <td className="px-2 py-2">{low || "—"}</td>
                            <td className="px-2 py-2 text-zinc-500">—</td>
                          </tr>
                        );
                      })}
                    {visitItems.length === 0 ? (
                      <tr>
                        <td className="px-2 py-3 text-zinc-600" colSpan={6}>
                          No visits in this window.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Showing up to 50 rows. Loaded rows: {visitItems.length}.
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-600">
                Debug: raw response
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">
                    chemist-details
                  </div>
                  <RawJson data={detailsQ.data} />
                </div>
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">visit-log</div>
                  <RawJson data={logQ.data} />
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
