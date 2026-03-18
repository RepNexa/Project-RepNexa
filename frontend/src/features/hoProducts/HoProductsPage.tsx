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

function pickStr(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function toIsoDateOrNull(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

function normalizeGradeLabel(v: any): string {
  const raw = String(v ?? "").trim();
  const upper = raw.toUpperCase().replace(/[_\s]+/g, "-");

  if (upper === "A" || upper === "A-GRADE") return "A";
  if (upper === "B" || upper === "B-GRADE") return "B";
  if (upper === "C" || upper === "C-GRADE") return "C";
  if (upper === "UNSPECIFIED" || upper === "UNKNOWN" || upper === "") {
    return "Unspecified";
  }

  return raw;
}

function gradeOrder(label: string): number {
  const upper = label.toUpperCase();
  if (upper === "A") return 0;
  if (upper === "B") return 1;
  if (upper === "C") return 2;
  if (upper === "UNSPECIFIED") return 99;
  return 50;
}

function pageCard(extra?: string) {
  return [
    "rounded-3xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-200/40",
    extra ?? "",
  ].join(" ");
}

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
  contentClassName = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={pageCard(`min-w-0 overflow-hidden ${className}`)}>
      {(title || subtitle) && (
        <div className="border-b border-zinc-100 px-5 py-4 sm:px-6">
          {title ? (
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      )}
      <div className={`min-w-0 px-5 py-5 sm:px-6 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
}) {
  return (
    <div className={pageCard("relative overflow-hidden p-5")}>
      <div className="absolute inset-x-0 top-0 h-1 bg-violet-500/80" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-4 text-[2rem] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </div>
      <div className="mt-4 text-sm text-zinc-500">{subtext ?? "—"}</div>
    </div>
  );
}

function EmptySelectionState({
  title,
  body,
  accentLabel,
  accentGlyph,
  tiles,
}: {
  title: string;
  body: string;
  accentLabel: string;
  accentGlyph: string;
  tiles: Array<{ title: string; body: string }>;
}) {
  return (
    <div className={pageCard("p-6 md:p-8")}>
      <div className="rounded-[28px] border border-dashed border-zinc-200 bg-[linear-gradient(180deg,rgba(250,250,250,0.98),rgba(244,244,245,0.72))] px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-200 bg-violet-50 text-2xl text-violet-700 shadow-sm">
            {accentGlyph}
          </div>

          <div className="mt-4 inline-flex items-center rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            {accentLabel}
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">
            {title}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 md:text-base">
            {body}
          </p>

          <div className="mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {tiles.map((tile) => (
              <div
                key={tile.title}
                className="rounded-2xl border border-zinc-200/80 bg-white/90 px-5 py-5 text-left shadow-sm shadow-zinc-200/30"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {tile.title}
                </div>
                <div className="mt-3 text-sm leading-6 text-zinc-600">
                  {tile.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TableHeadCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </th>
  );
}

function TableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3.5 align-middle text-zinc-700 ${className}`}>
      {children}
    </td>
  );
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
  }, [detailsQ.error, pathname, productId, router, sp]);

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

  const isSelected = typeof productId === "number" && productId > 0;

  const prod = detailsQ.data?.product ?? null;
  const productCode = pickStr(prod, ["code"]) ?? null;
  const productName = pickStr(prod, ["name"]) ?? null;

  const totalCalls = detailsQ.data?.visitCount ?? null;
  const uniqueDoctors = detailsQ.data?.uniqueDoctors ?? null;
  const oosCount = detailsQ.data?.oosCount ?? null;
  const lowCount = detailsQ.data?.lowCount ?? null;
  const lastDetailedDate = toIsoDateOrNull(detailsQ.data?.lastDetailedDate);

  const rawCoverageRows = (coverageQ.data ?? []).map((r: any) => ({
    label: normalizeGradeLabel(r.grade),
    value: Number(r.count ?? 0),
  }));

  const coverageMap = rawCoverageRows.reduce<Record<string, number>>(
    (acc, row) => {
      const key = row.label;
      acc[key] = (acc[key] ?? 0) + row.value;
      return acc;
    },
    {},
  );

  const coverageRows = Object.entries(coverageMap)
    .map(([label, value]) => ({ label, value }))
    .filter((row) => Number.isFinite(row.value) && row.value >= 0)
    .sort((a, b) => {
      const diff = gradeOrder(a.label) - gradeOrder(b.label);
      return diff !== 0 ? diff : b.value - a.value;
    });

  const aGradeCovered =
    coverageRows.find((x) => x.label.toUpperCase() === "A")?.value ?? null;

  const oosRouteChart = (detailsQ.data?.oosByRoute ?? [])
    .map((x: any) => ({
      label: String(x.key),
      value: Number(x.count ?? 0),
    }))
    .filter((x: any) => Number.isFinite(x.value))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 8);

  const callsOverTimePts = (callsQ.data ?? [])
    .map((r: any) => ({
      x: String(r.x ?? "").slice(0, 10),
      y: Number(r.y ?? 0),
    }))
    .filter((r: any) => r.x && Number.isFinite(r.y))
    .sort((a: any, b: any) => a.x.localeCompare(b.x));

  const oosChemItems = oosChemQ.data?.items ?? [];
  const topDoctorItems = topQ.data?.items ?? [];

  const filterBusy =
    detailsQ.isFetching ||
    callsQ.isFetching ||
    coverageQ.isFetching ||
    oosChemQ.isFetching ||
    topQ.isFetching;

  return (
    <div className="w-full bg-[#f6f7fb]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <style jsx global>{`
          .product-calls-chart,
          .product-calls-chart * {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .product-calls-chart *::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
        `}</style>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-950">
              Products
            </h1>
            <div className="mt-1 text-sm text-zinc-600">
              Search and drill into product analytics with a unified dashboard
              layout.
            </div>
          </div>

          <Link
            href="/ho"
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>

        {(lookupErr || notFoundMsg || detailsQ.error) && (
          <div className="mb-4 space-y-3">
            {lookupErr ? (
              <ApiErrorBanner err={lookupErr as unknown as ApiError} />
            ) : null}

            {notFoundMsg ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {notFoundMsg}
              </div>
            ) : null}

            {detailsQ.error && !notFoundMsg ? (
              <ApiErrorBanner err={detailsQ.error as unknown as ApiError} />
            ) : null}
          </div>
        )}

        {!isSelected ? (
          <>
            <SectionCard className="mb-6" contentClassName="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.9fr]">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Search
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <SimpleTypeahead<number>
                      key={`product-typeahead-${productId ?? "none"}`}
                      label="Product"
                      placeholder="Type a code or name..."
                      fetchOptions={fetchOptions}
                      onSelect={(opt) => onSelect(opt.value)}
                    />

                    <div className="mt-4">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Or enter product ID
                      </div>
                      <input
                        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                        type="number"
                        min={1}
                        placeholder="e.g. 2"
                        value={productId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          router.replace(
                            buildUrlWithParams(pathname, sp, {
                              productId: v ?? null,
                            }),
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Filters
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <DrilldownFilterBar
                      value={rawFilters}
                      onChange={onFilters}
                      isFetching={filterBusy}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="mt-5">
              <EmptySelectionState
                accentGlyph="P"
                accentLabel="Product detail"
                title="No product selected"
                body="Search for a product by code or name, or enter a product ID to view coverage, detailing activity, stock-out trends, and doctor performance for the selected product."
                tiles={[
                  {
                    title: "Coverage",
                    body: "Review doctor reach by grade for the selected product in the current period.",
                  },
                  {
                    title: "Activity",
                    body: "Track detailing calls over time and identify trends in product engagement.",
                  },
                  {
                    title: "Stock-out",
                    body: "See OOS and low-stock signals across routes and chemists in the selected window.",
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <>
            <SectionCard className="mb-6" contentClassName="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.9fr]">
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Search
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <SimpleTypeahead<number>
                      key={`product-typeahead-${productId ?? "none"}`}
                      label="Product"
                      placeholder="Type a code or name…"
                      fetchOptions={fetchOptions}
                      onSelect={(opt) => onSelect(opt.value)}
                    />

                    <div className="mt-4">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Or enter product ID
                      </div>
                      <input
                        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                        type="number"
                        min={1}
                        value={productId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          router.replace(
                            buildUrlWithParams(pathname, sp, {
                              productId: v ?? null,
                            }),
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Filters
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <DrilldownFilterBar
                      value={rawFilters}
                      onChange={onFilters}
                      isFetching={filterBusy}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <StatCard
                label="Product"
                value={productCode ?? `Product #${productId}`}
                subtext={productName ?? "Selected product"}
              />
              <StatCard
                label="A-grade Doctors Covered"
                value={aGradeCovered ?? "—"}
                subtext="Unique doctors detailed in period"
              />
              <StatCard
                label="Total Detailing Calls"
                value={totalCalls ?? "—"}
                subtext="Across the selected period"
              />
              <StatCard
                label="Last Detailed"
                value={lastDetailedDate ?? "—"}
                subtext="Most recent detailing date"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <SectionCard
                title="Coverage by Grade"
                subtitle="Unique doctors detailed in the selected period"
              >
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4">
                  {coverageQ.isLoading ? (
                    <div className="text-sm text-zinc-500">Loading coverage…</div>
                  ) : coverageRows.length === 0 ? (
                    <EmptyCard title="No coverage in window" />
                  ) : (
                    <MiniHBarChart rows={coverageRows} maxRows={8} />
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Detailing Calls Over Time"
                subtitle="Call activity for the selected product"
              >
                <div className="product-calls-chart rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4 overflow-hidden">
                  {callsQ.isLoading ? (
                    <div className="text-sm text-zinc-500">
                      Loading call trend…
                    </div>
                  ) : callsOverTimePts.length === 0 ? (
                    <EmptyCard title="No calls in window" />
                  ) : (
                    <MiniLineChart points={callsOverTimePts} />
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <SectionCard
                title="Top Doctors for This Product"
                subtitle="Doctors with the highest call volume in the selected period"
              >
                <TableShell>
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/90">
                      <tr>
                        <TableHeadCell>Doctor</TableHeadCell>
                        <TableHeadCell>Grade</TableHeadCell>
                        <TableHeadCell>Route</TableHeadCell>
                        <TableHeadCell># Calls</TableHeadCell>
                        <TableHeadCell>Last Detailed</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {topQ.isLoading ? (
                        <tr className="border-t border-zinc-100">
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-sm text-zinc-500"
                          >
                            Loading doctors…
                          </td>
                        </tr>
                      ) : topDoctorItems.length === 0 ? (
                        <tr className="border-t border-zinc-100">
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-sm text-zinc-500"
                          >
                            No doctor activity in this window.
                          </td>
                        </tr>
                      ) : (
                        topDoctorItems.map((row: any, idx: number) => (
                          <tr
                            key={`${row.doctorId}-${idx}`}
                            className="border-t border-zinc-100 transition hover:bg-zinc-50/60"
                          >
                            <TableCell className="font-medium text-zinc-900">
                              {row.doctorName ?? `Doctor ${idx + 1}`}
                            </TableCell>
                            <TableCell>
                              {row.grade ? (
                                <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                  {String(row.grade)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {row.routeName ?? row.routeCode ?? "—"}
                            </TableCell>
                            <TableCell className="font-medium text-zinc-900">
                              {Number(row.callCount ?? 0)}
                            </TableCell>
                            <TableCell>
                              {toIsoDateOrNull(row.lastDetailedDate) ?? "—"}
                            </TableCell>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableShell>
              </SectionCard>

              <SectionCard
                title="Stock-Out Summary"
                subtitle="OOS and low-stock view for the selected product"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      OOS Events
                    </div>
                    <div className="mt-3 text-[2rem] font-semibold leading-none tracking-tight text-zinc-950">
                      {oosCount ?? 0}
                    </div>
                    <div className="mt-2 text-sm text-zinc-500">
                      In selected period
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Low Stock
                    </div>
                    <div className="mt-3 text-[2rem] font-semibold leading-none tracking-tight text-zinc-950">
                      {lowCount ?? 0}
                    </div>
                    <div className="mt-2 text-sm text-zinc-500">
                      In selected period
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4">
                  <div className="mb-3 text-sm font-semibold text-zinc-900">
                    OOS by Route
                  </div>
                  {oosRouteChart.length === 0 ? (
                    <EmptyCard title="No OOS events in window" />
                  ) : (
                    <MiniHBarChart rows={oosRouteChart} maxRows={8} />
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="mt-6">
              <SectionCard
                title="OOS Chemists"
                subtitle="Chemists with recorded OOS events for the selected period"
              >
                <TableShell>
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/90">
                      <tr>
                        <TableHeadCell>Chemist</TableHeadCell>
                        <TableHeadCell>Route</TableHeadCell>
                        <TableHeadCell>OOS Events</TableHeadCell>
                        <TableHeadCell>Last OOS Date</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {oosChemQ.isLoading ? (
                        <tr className="border-t border-zinc-100">
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-sm text-zinc-500"
                          >
                            Loading OOS chemists…
                          </td>
                        </tr>
                      ) : oosChemItems.length === 0 ? (
                        <tr className="border-t border-zinc-100">
                          <td
                            colSpan={4}
                            className="px-4 py-8 text-center text-sm text-zinc-500"
                          >
                            No OOS chemist activity in this window.
                          </td>
                        </tr>
                      ) : (
                        oosChemItems.map((row: any, idx: number) => (
                          <tr
                            key={`${row.chemistId}-${idx}`}
                            className="border-t border-zinc-100 transition hover:bg-zinc-50/60"
                          >
                            <TableCell className="font-medium text-zinc-900">
                              {row.chemistName ?? `Chemist ${idx + 1}`}
                            </TableCell>
                            <TableCell>{row.routeName ?? "—"}</TableCell>
                            <TableCell className="font-medium text-zinc-900">
                              {Number(row.oosEvents ?? 0)}
                            </TableCell>
                            <TableCell>
                              {toIsoDateOrNull(row.lastOosDate) ?? "—"}
                            </TableCell>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </TableShell>
              </SectionCard>
            </div>

            {uniqueDoctors !== null ? (
              <div className="mt-6 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm shadow-zinc-200/30">
                <span className="font-medium text-zinc-900">
                  Unique doctors covered:
                </span>{" "}
                {uniqueDoctors}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}