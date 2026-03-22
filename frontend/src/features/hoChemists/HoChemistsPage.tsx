"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ApiError } from "@/src/lib/api/types";
import { SimpleTypeahead } from "@/src/features/shared/components/SimpleTypeahead";
import { DrilldownFilterBar } from "@/src/features/hoDrilldowns/common/FilterBar";
import {
  ApiErrorBanner,
  EmptyCard,
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
import { MiniLineChart } from "@/src/features/hoDrilldowns/common/MiniCharts";

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
    <section className={pageCard(`min-w-0 ${className}`)}>
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

function KpiCard({
  label,
  value,
  helper,
  danger,
}: {
  label: string;
  value: string;
  helper?: string;
  danger?: boolean;
}) {
  return (
    <div className={pageCard("relative overflow-hidden p-5")}>
      <div className="absolute inset-x-0 top-0 h-1 bg-violet-500/80" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-4 text-[2.1rem] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </div>
      <div
        className={`mt-4 text-sm ${
          danger ? "text-rose-500" : "text-zinc-500"
        }`}
      >
        {helper ?? "—"}
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-zinc-900">{value}</div>
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

function TableToggleButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 flex justify-start">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        {expanded ? "Show less" : "See more"}
      </button>
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

function TableRow({
  children,
  tinted = false,
}: {
  children: React.ReactNode;
  tinted?: boolean;
}) {
  return (
    <tr
      className={`border-t border-zinc-100 transition hover:bg-zinc-50/60 ${
        tinted ? "bg-rose-50/40" : "bg-white"
      }`}
    >
      {children}
    </tr>
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
    <td className={`px-4 py-3.5 align-top text-zinc-700 ${className}`}>
      {children}
    </td>
  );
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
  const [showAllOosRows, setShowAllOosRows] = React.useState(false);
  const [showAllVisitRows, setShowAllVisitRows] = React.useState(false);

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
  }, [chemistId, detailsQ.error, pathname, router, sp]);

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
    setShowAllOosRows(false);
    setShowAllVisitRows(false);
    router.replace(buildUrlWithParams(pathname, sp, { chemistId: id }));
  };

  const onFilters = (next: DrilldownFilters) => {
    setNotFoundMsg(null);
    setRepFilter("ALL");
    setProductFilter("ALL");
    setShowAllOosRows(false);
    setShowAllVisitRows(false);
    router.replace(
      buildUrlWithParams(pathname, sp, {
        period: next.period,
        dateFrom: next.period === "CUSTOM" ? (next.dateFrom ?? null) : null,
        dateTo: next.period === "CUSTOM" ? (next.dateTo ?? null) : null,
      }),
    );
  };

  React.useEffect(() => {
    setShowAllOosRows(false);
    setShowAllVisitRows(false);
  }, [chemistId, period, dateFrom, dateTo, repFilter, productFilter]);

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

  const allVisitItems = React.useMemo(() => logQ.data?.items ?? [], [logQ.data]);

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

  const sortedVisitRows = React.useMemo(() => {
    return visitItems
      .slice()
      .sort((a: any, b: any) => {
        const ad = toIsoDateOrNull(pickStr(a, ["visitDate", "visit_date"])) ?? "";
        const bd = toIsoDateOrNull(pickStr(b, ["visitDate", "visit_date"])) ?? "";
        return bd.localeCompare(ad);
      });
  }, [visitItems]);

  const oosRowsToRender = React.useMemo(
    () => (showAllOosRows ? oosHistoryRows : oosHistoryRows.slice(0, 5)),
    [oosHistoryRows, showAllOosRows],
  );

  const visitRowsToRender = React.useMemo(
    () => (showAllVisitRows ? sortedVisitRows : sortedVisitRows.slice(0, 5)),
    [sortedVisitRows, showAllVisitRows],
  );

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

  const latestOosProduct = oosChartRows[0]?.label ?? null;
  const territoryLabel = pickStr(chemistObj, ["routeName", "routeCode"]) ?? "—";

  return (
    <div className="w-full bg-[#f6f7fb]">
      <div className="w-full px-2 py-6 md:px-4">
        <div className="mb-6">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-950">
              Chemists
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Search and drill into chemist analytics with a unified dashboard
              layout.
            </p>
          </div>
        </div>

        {err ? <ApiErrorBanner err={err} /> : null}
        {notFoundMsg ? <EmptyCard title={notFoundMsg} /> : null}

        <SectionCard
          className="mb-6 overflow-visible"
          contentClassName="overflow-visible"
        >
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[1.2fr_0.9fr]">
            <div className="relative z-20 min-w-0 border-r border-zinc-200/80 pr-0 xl:pr-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Search
              </div>
              <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/70 p-5">
                <SimpleTypeahead<number>
                  key={String(chemistId ?? "none")}
                  label="Chemist"
                  placeholder="Type a name..."
                  fetchOptions={fetchOptions}
                  onSelect={(opt) => onSelect(opt.value)}
                />

                {lookupErr ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Lookup unavailable:{" "}
                    <span className="font-mono">{lookupErr.status}</span>{" "}
                    <span className="font-mono">{lookupErr.code}</span>. Use the
                    ID input below.
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Or enter chemist ID
                  </div>
                  <input
                    className="mt-2 h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
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
            </div>

            <div className="relative z-30 min-w-0 pt-5 xl:pt-0 xl:pl-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Filters
              </div>
              <div className="rounded-[24px] border border-zinc-200/80 bg-zinc-50/70 p-5">
                <DrilldownFilterBar
                  value={rawFilters}
                  onChange={onFilters}
                  isFetching={detailsQ.isFetching}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {detailsQ.isLoading ? (
          <div className={pageCard("p-6")}>
            <SkeletonBox lines={7} />
          </div>
        ) : !chemistId ? (
          <EmptySelectionState
            accentGlyph="C"
            accentLabel="Chemist detail"
            title="No chemist selected"
            body="Search for a chemist by name or enter a chemist ID to view visit activity, stock-out history, and recent field signals for the selected outlet."
            tiles={[
              {
                title: "Search",
                body: "Find a chemist quickly by typing the outlet name in the lookup field above.",
              },
              {
                title: "Filter",
                body: "Keep the current period or switch to a custom date range before reviewing analytics.",
              },
              {
                title: "Drill down",
                body: "Inspect visits, OOS patterns, and recent activity once a chemist has been selected.",
              },
            ]}
          />
        ) : detailsQ.error ? (
          isApiError(detailsQ.error) ? (
            <ApiErrorBanner err={detailsQ.error} />
          ) : (
            <EmptyCard title="Failed to load details" />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className={pageCard("relative overflow-hidden p-5")}>
                <div className="absolute inset-x-0 top-0 h-1 bg-violet-500/80" />
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Chemist
                </div>
                <div className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight text-zinc-950">
                  {chemistName}
                </div>
                <div className="mt-4 inline-flex rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                  {territoryLabel}
                </div>
              </div>

              <KpiCard
                label="Chemist Visits"
                value={String(totalVisits ?? "—")}
                helper={repFilter === "ALL" ? "All reps" : repFilter}
              />

              <KpiCard
                label="OOS Events"
                value={String(oosCount)}
                helper={oosCount > 0 ? "Chronic OOS risk" : "No OOS trend"}
                danger={oosCount > 0}
              />

              <KpiCard
                label="Last OOS Date"
                value={lastOosDate ?? "—"}
                helper={latestOosProduct ?? "No recent OOS product"}
              />
            </div>

            <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
              <SectionCard
                title="Chemist Profile"
                subtitle="Basic information and recent signals for this outlet"
                className="overflow-hidden"
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                      Territory: {territoryLabel}
                    </span>
                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                      Status: Active
                    </span>
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                      Channel: Retail
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-700">
                      Recent OOS products
                    </span>
                    {oosChartRows.length === 0 ? (
                      <span className="text-sm text-zinc-500">—</span>
                    ) : (
                      oosChartRows.slice(0, 4).map((p) => (
                        <span
                          key={p.label}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                        >
                          {p.label}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailStat
                      label="Route ID"
                      value={pickNum(chemistObj, ["routeId", "route_id"]) ?? "—"}
                    />
                    <DetailStat
                      label="Avg visits / month"
                      value={avgPerMonth ?? "—"}
                    />
                    <DetailStat label="Last visit" value={lastVisitDate ?? "—"} />
                    <DetailStat
                      label="Last OOS date"
                      value={lastOosDate ?? "—"}
                    />
                  </div>

                  <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 text-sm text-zinc-600">
                    <span className="font-medium text-zinc-800">
                      LOW stock events:
                    </span>{" "}
                    {lowCount}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Visits to This Chemist Over Time"
                subtitle="Weekly chemist visit trend"
                className="min-w-0 overflow-hidden"
              >
                <div className="flex min-w-0 flex-col">
                  <div className="min-w-0 rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4">
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
                      <div className="block w-full min-w-0 overflow-hidden">
                        <div className="w-full min-w-0 [&_*]:max-w-full">
                          <MiniLineChart points={visitTrend} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-sm text-zinc-500">
                    Helps show whether chemist coverage is consistent over the
                    selected period.
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="mt-6">
              <SectionCard
                title="Stock-Out History – This Chemist"
                subtitle={`OOS events by product at ${chemistName}`}
                className="overflow-hidden"
              >
                <TableShell>
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-zinc-50/90">
                      <tr>
                        <TableHeadCell>Date</TableHeadCell>
                        <TableHeadCell>Product</TableHeadCell>
                        <TableHeadCell>Rep</TableHeadCell>
                        <TableHeadCell>Status</TableHeadCell>
                        <TableHeadCell>Remark</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {oosRowsToRender.map((r, idx) => (
                        <TableRow
                          key={`${r.date}-${r.product}-${r.status}-${idx}`}
                          tinted={r.status === "OOS"}
                        >
                          <TableCell>{r.date || "—"}</TableCell>
                          <TableCell className="font-medium text-zinc-900">
                            {r.product}
                          </TableCell>
                          <TableCell>{r.rep}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                r.status === "OOS"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-500">—</TableCell>
                        </TableRow>
                      ))}
                      {oosHistoryRows.length === 0 ? (
                        <tr className="border-t border-zinc-100">
                          <td className="px-4 py-5 text-zinc-500" colSpan={5}>
                            No OOS/LOW events in this window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </TableShell>

                {oosHistoryRows.length > 5 ? (
                  <TableToggleButton
                    expanded={showAllOosRows}
                    onClick={() => setShowAllOosRows((v) => !v)}
                  />
                ) : null}
              </SectionCard>
            </div>

            <div className="mt-6">
              <SectionCard
                title="Recent Visits & Notes – This Chemist"
                subtitle="Combines visit log and available product flags"
                className="overflow-hidden"
              >
                <TableShell>
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-zinc-50/90">
                      <tr>
                        <TableHeadCell>Date</TableHeadCell>
                        <TableHeadCell>Rep</TableHeadCell>
                        <TableHeadCell>Territory</TableHeadCell>
                        <TableHeadCell>Products Detailed</TableHeadCell>
                        <TableHeadCell>Notes</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {visitRowsToRender.map((it: any, idx: number) => {
                        const d =
                          toIsoDateOrNull(
                            pickStr(it, ["visitDate", "visit_date"]),
                          ) ?? "—";
                        const rep =
                          pickStr(it, [
                            "repUsername",
                            "rep_username",
                            "rep",
                          ]) ?? "—";
                        const terr =
                          pickStr(it, ["routeName", "routeCode"]) ?? "—";
                        const oos = (it?.oosProductCodes ?? [])
                          .map(String)
                          .filter(Boolean);
                        const low = (it?.lowProductCodes ?? [])
                          .map(String)
                          .filter(Boolean);
                        const products = [...new Set([...oos, ...low])].join(", ");

                        return (
                          <TableRow
                            key={String(
                              pickNum(it, ["visitId", "visit_id"]) ?? idx,
                            )}
                          >
                            <TableCell>{d}</TableCell>
                            <TableCell className="font-medium text-zinc-900">
                              {rep}
                            </TableCell>
                            <TableCell>{terr}</TableCell>
                            <TableCell>{products || "—"}</TableCell>
                            <TableCell className="text-zinc-500">—</TableCell>
                          </TableRow>
                        );
                      })}

                      {visitItems.length === 0 ? (
                        <tr className="border-t border-zinc-100">
                          <td className="px-4 py-5 text-zinc-500" colSpan={5}>
                            No visits in this window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </TableShell>

                {sortedVisitRows.length > 5 ? (
                  <TableToggleButton
                    expanded={showAllVisitRows}
                    onClick={() => setShowAllVisitRows((v) => !v)}
                  />
                ) : null}
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}