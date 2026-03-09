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
  type DrilldownFilters,
  type DrilldownPeriod,
} from "@/src/features/hoDrilldowns/common/types";
import {
  buildUrlWithParams,
  readIntParam,
  readStrParam,
} from "@/src/features/hoDrilldowns/common/url";
import { useCachedTypeahead } from "@/src/features/hoDrilldowns/common/typeahead";
import {
  lookupProducts,
  productCallsOverTime,
  productCoverageByGrade,
  productDetails,
  productTopDoctors,
  productOosChemists,
} from "./api";
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

function pickFirstRow(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data.rows) && data.rows.length) return data.rows[0];
  if (Array.isArray(data.items) && data.items.length) return data.items[0];
  if (data.row && typeof data.row === "object") return data.row;
  return null;
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

export function HoProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const productId = readIntParam(sp, "productId");
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

  const detailsQ = useQuery({
    queryKey: [
      "hoProductDetails",
      productId ?? "none",
      stableStringify(filters),
    ],
    queryFn: () => productDetails(productId as number, filters),
    enabled: typeof productId === "number" && productId > 0,
    staleTime: 120_000,
  });

  React.useEffect(() => {
    if (!productId) return;
    const err = detailsQ.error as any;
    if (isApiError(err) && err.status === 404) {
      setNotFoundMsg(`Product not found (id=${productId}).`);
      router.replace(buildUrlWithParams(pathname, sp, { productId: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsQ.error]);

  const { fetchOptions, lastErr: lookupErr } = useCachedTypeahead({
    keyPrefix: ["hoLookup", "products"],
    fetcher: lookupProducts,
    map: (p: any) => ({
      key: String(p.id),
      label: `${String(p.code ?? "PRD")} — ${String(p.name ?? "Product")} (ID ${p.id})`,
      value: Number(p.id),
    }),
    staleTimeMs: 120_000,
  });

  const onSelect = (id: number) => {
    setNotFoundMsg(null);
    router.replace(buildUrlWithParams(pathname, sp, { productId: id }));
  };

  const onFilters = (next: DrilldownFilters) => {
    setNotFoundMsg(null);
    router.replace(
      buildUrlWithParams(pathname, sp, {
        period: next.period,
        // Don't keep CUSTOM dates when switching back to THIS_MONTH/LAST_MONTH.
        dateFrom: next.period === "CUSTOM" ? (next.dateFrom ?? null) : null,
        dateTo: next.period === "CUSTOM" ? (next.dateTo ?? null) : null,
      }),
    );
  };

  const callsQ = useQuery({
    queryKey: [
      "hoProductCallsOverTime",
      productId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    enabled: typeof productId === "number" && productId > 0 && !!range,
    queryFn: () =>
      productCallsOverTime({
        productId: productId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
      }),
    staleTime: 60_000,
  });

  const oosChemQ = useQuery({
    queryKey: [
      "hoProductOosChemists",
      productId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    enabled: typeof productId === "number" && productId > 0 && !!range,
    queryFn: () =>
      productOosChemists({
        productId: productId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
        page: 0,
        size: 10,
      }),
    staleTime: 60_000,
  });

  const coverageQ = useQuery({
    queryKey: [
      "hoProductCoverageByGrade",
      productId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    enabled: typeof productId === "number" && productId > 0 && !!range,
    queryFn: () =>
      productCoverageByGrade({
        productId: productId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
      }),
    staleTime: 60_000,
  });

  const topQ = useQuery({
    queryKey: [
      "hoProductTopDoctors",
      productId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    enabled: typeof productId === "number" && productId > 0 && !!range,
    queryFn: () =>
      productTopDoctors({
        productId: productId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
        page: 0,
        size: 25,
      }),
    staleTime: 60_000,
  });

  const oosChemItems = React.useMemo(() => {
    return oosChemQ.data?.items ?? [];
  }, [oosChemQ.data]);

  const mostOosChemist = oosChemItems.length ? oosChemItems[0] : null;

  const err: ApiError | null = (detailsQ.error as any) || null;
  const prod = detailsQ.data?.product ?? null;
  const productCode = pickStr(prod, ["code"]) ?? null;
  const productName = pickStr(prod, ["name"]) ?? null;
  const totalCalls =
    typeof detailsQ.data?.visitCount === "number"
      ? detailsQ.data.visitCount
      : null;
  const uniqueDoctors =
    typeof detailsQ.data?.uniqueDoctors === "number"
      ? detailsQ.data.uniqueDoctors
      : null;
  const oosCount =
    typeof detailsQ.data?.oosCount === "number" ? detailsQ.data.oosCount : null;
  const lowCount =
    typeof detailsQ.data?.lowCount === "number" ? detailsQ.data.lowCount : null;
  const oosByRoute: Array<{ key: string; count: number }> = Array.isArray(
    detailsQ.data?.oosByRoute,
  )
    ? detailsQ.data.oosByRoute
    : [];

  const lastDetailedDate = toIsoDateOrNull(detailsQ.data?.lastDetailedDate);

  const oosRouteChart = React.useMemo(
    () =>
      oosByRoute
        .map((x) => ({ label: String(x.key), value: Number(x.count ?? 0) }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
        .slice(0, 8),
    [oosByRoute],
  );

  const callsOverTimePts = React.useMemo(() => {
    const rows: any[] = Array.isArray(callsQ.data)
      ? (callsQ.data as any[])
      : [];
    return rows
      .map((r) => ({ x: String(r.x ?? "").slice(0, 10), y: Number(r.y ?? 0) }))
      .filter((p) => p.x && Number.isFinite(p.y))
      .sort((a, b) => a.x.localeCompare(b.x));
  }, [callsQ.data]);

  const coverageRows = React.useMemo(() => {
    const rows: any[] = Array.isArray(coverageQ.data)
      ? (coverageQ.data as any[])
      : [];
    return rows
      .map((r) => ({
        label: String(r.grade ?? "UNSPECIFIED"),
        value: Number(r.count ?? 0),
      }))
      .filter((x) => x.label && Number.isFinite(x.value))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 10);
  }, [coverageQ.data]);

  const aGradeCovered =
    coverageRows.find((x) => String(x.label).toUpperCase() === "A")?.value ??
    null;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <div className="text-sm text-zinc-600">
            Search and drill into product analytics (Milestone 7). Includes OOS
            tables (best-effort).
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
            label="Product"
            placeholder="Type a code or name…"
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
            <div className="text-xs text-zinc-600">Or enter Product ID</div>
            <input
              className="mt-1 h-10 w-full rounded border px-2"
              type="number"
              min={1}
              value={productId ?? ""}
              placeholder="e.g. 5"
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                router.replace(
                  buildUrlWithParams(pathname, sp, { productId: v ?? null }),
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
        <div className="mb-2 text-sm font-medium">Product drilldown</div>
        {detailsQ.isLoading ? (
          <SkeletonBox lines={7} />
        ) : !productId ? (
          <EmptyCard
            title="No product selected"
            body="Use the search box or enter a product ID."
          />
        ) : detailsQ.error ? (
          isApiError(detailsQ.error) ? (
            <ApiErrorBanner err={detailsQ.error} />
          ) : (
            <EmptyCard title="Failed to load details" />
          )
        ) : (
          <>
            {/* KPI row (prototype-aligned) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Product</div>
                <div className="mt-1 text-2xl font-semibold">
                  {productCode ? (
                    <span className="font-mono">{productCode}</span>
                  ) : (
                    `Product #${productId}`
                  )}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  {productName ?? "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">
                  A-grade Doctors Covered
                </div>
                <div className="mt-1 text-3xl font-semibold">
                  {aGradeCovered ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  From coverage-by-grade (grade A).
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">
                  Total Detailing Calls
                </div>
                <div className="mt-1 text-3xl font-semibold">
                  {totalCalls ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  From product-details.visitCount.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Last Detailed</div>
                <div className="mt-1 text-3xl font-semibold">
                  {lastDetailedDate ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Across all reps (in scope).
                </div>
              </div>
            </div>

            {/* Detail row */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Product Snapshot</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Static summary for the selected SKU (best-effort).
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Code</div>
                    <div className="text-right font-mono">
                      {productCode ?? "—"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Name</div>
                    <div className="text-right">{productName ?? "—"}</div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Unique doctors (period)</div>
                    <div className="text-right">{uniqueDoctors ?? "—"}</div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">OOS / LOW (period)</div>
                    <div className="text-right">
                      {(oosCount ?? 0) + (lowCount ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">
                  Coverage by Grade {productCode ? `(${productCode})` : ""}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Unique doctors detailed in selected period.
                </div>
                <div className="mt-3">
                  {coverageQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : coverageQ.error ? (
                    <EmptyCard title="Coverage unavailable" />
                  ) : coverageRows.length === 0 ? (
                    <EmptyCard title="No coverage in window" />
                  ) : (
                    <MiniHBarChart rows={coverageRows} maxRows={8} />
                  )}
                </div>
              </div>
            </div>

            {/* Analytics row */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Detailing Calls Over Time</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Calls where this product was promoted (weekly).
                </div>
                <div className="mt-3">
                  {callsQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : callsQ.error ? (
                    <EmptyCard title="Trend unavailable" />
                  ) : callsOverTimePts.length === 0 ? (
                    <EmptyCard title="No calls in window" />
                  ) : (
                    <MiniLineChart points={callsOverTimePts} />
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Stock-Out Summary</div>
                <div className="mt-1 text-sm text-zinc-600">
                  High-level OOS view (best-effort from existing endpoints).
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded border bg-white p-3">
                    <div className="text-xs text-zinc-600">
                      OOS events (period)
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {oosCount ?? "—"}
                    </div>
                  </div>
                  <div className="rounded border bg-white p-3">
                    <div className="text-xs text-zinc-600">
                      LOW stock (period)
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {lowCount ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium">OOS by Route</div>
                  <div className="mt-2">
                    {oosRouteChart.length === 0 ? (
                      <EmptyCard title="No OOS events in window" />
                    ) : (
                      <MiniHBarChart rows={oosRouteChart} maxRows={8} />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="font-semibold">OOS Chemists</div>
                  <div className="text-sm text-zinc-600">
                    Chemists with the most OOS events for this product.
                  </div>

                  {oosChemQ.isLoading ? (
                    <div className="mt-3">
                      <SkeletonBox lines={6} />
                    </div>
                  ) : oosChemQ.error ? (
                    <div className="mt-3">
                      {isApiError(oosChemQ.error) ? (
                        <ApiErrorBanner err={oosChemQ.error} />
                      ) : (
                        <EmptyCard title="Failed to load OOS chemists" />
                      )}
                    </div>
                  ) : oosChemItems.length === 0 ? (
                    <div className="mt-3">
                      <EmptyCard title="No OOS chemists in window" />
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-xs text-zinc-600">
                            Most OOS Chemist
                          </div>
                          <div className="mt-1 text-lg font-semibold">
                            {String(mostOosChemist?.chemistName ?? "—")}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600">
                            {String(mostOosChemist?.routeName ?? "—")}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {Number(mostOosChemist?.oosEvents ?? 0)} OOS events
                            • Last:{" "}
                            {toIsoDateOrNull(mostOosChemist?.lastOosDate) ??
                              "—"}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-xs text-zinc-600">
                            OOS Events (Period)
                          </div>
                          <div className="mt-1 text-2xl font-semibold">
                            {oosCount ?? 0}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            From product-details.oosCount.
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 overflow-auto rounded border">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-50 text-left">
                            <tr>
                              <th className="p-2">Chemist</th>
                              <th className="p-2">Territory</th>
                              <th className="p-2">OOS Events</th>
                              <th className="p-2">Last OOS Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {oosChemItems.map((r: any, idx: number) => (
                              <tr
                                key={String(r?.chemistId ?? idx)}
                                className="border-t"
                              >
                                <td className="p-2">
                                  {String(r?.chemistName ?? "—")}
                                </td>
                                <td className="p-2">
                                  {String(r?.routeName ?? "—")}
                                </td>
                                <td className="p-2 font-mono">
                                  {Number(r?.oosEvents ?? 0)}
                                </td>
                                <td className="p-2">
                                  {toIsoDateOrNull(r?.lastOosDate) ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-2 text-xs text-zinc-500">
                        Showing up to {oosChemQ.data?.size ?? 10} rows.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Doctors table */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="font-semibold">Top Doctors for This Product</div>
              <div className="mt-1 text-sm text-zinc-600">
                Doctors with highest call volume for this SKU (period).
              </div>

              {topQ.isLoading ? <SkeletonBox lines={8} /> : null}
              {!topQ.isLoading && topQ.error ? (
                <EmptyCard title="Top doctors unavailable" />
              ) : null}

              {!topQ.isLoading && !topQ.error ? (
                <div className="mt-3 overflow-x-auto rounded border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="px-2 py-2 text-left">Doctor</th>
                        <th className="px-2 py-2 text-left">Grade</th>
                        <th className="px-2 py-2 text-left">Territory</th>
                        <th className="px-2 py-2 text-left">
                          # Calls (Period)
                        </th>
                        <th className="px-2 py-2 text-left">Last Detailed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(topQ.data?.items ?? []).map((it: any, idx: number) => {
                        const name =
                          pickStr(it, ["doctorName", "name"]) ??
                          `Doctor #${pickNum(it, ["doctorId", "id"]) ?? "—"}`;
                        const grade = pickStr(it, ["grade"]) ?? "—";
                        const terr =
                          pickStr(it, [
                            "routeName",
                            "territory",
                            "routeCode",
                          ]) ?? "—";
                        const calls =
                          pickNum(it, ["callCount", "calls", "count"]) ?? 0;
                        const last = toIsoDateOrNull(
                          pickStr(it, [
                            "lastDetailedDate",
                            "lastDetailed",
                            "lastCallDate",
                          ]),
                        );
                        return (
                          <tr
                            key={String(pickNum(it, ["doctorId", "id"]) ?? idx)}
                          >
                            <td className="px-2 py-2">{name}</td>
                            <td className="px-2 py-2">{grade}</td>
                            <td className="px-2 py-2">{terr}</td>
                            <td className="px-2 py-2 font-mono">{calls}</td>
                            <td className="px-2 py-2">{last ?? "—"}</td>
                          </tr>
                        );
                      })}
                      {(topQ.data?.items ?? []).length === 0 ? (
                        <tr>
                          <td className="px-2 py-3 text-zinc-600" colSpan={5}>
                            No doctor calls found for this product in this
                            window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-600">
                Debug: raw response
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">
                    product-details
                  </div>
                  <RawJson data={detailsQ.data} />
                </div>
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">top-doctors</div>
                  <RawJson data={topQ.data} />
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
