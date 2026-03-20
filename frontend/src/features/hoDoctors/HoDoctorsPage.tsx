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
import { doctorDetails, doctorVisitLog, lookupDoctors } from "./api";
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

function extractVisitItems(data: any): any[] {
  if (!data) return [];
  const candidates = [data.items, data.rows, data.content, data.visits];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
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

async function fetchAllDoctorVisitLog(args: {
  doctorId: number;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<{ total: number; items: any[] }> {
  const size = Math.min(args.pageSize ?? 50, 50);
  const maxPages = args.maxPages ?? 40;

  const first = await doctorVisitLog({
    doctorId: args.doctorId,
    page: 0,
    size,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
  });

  let all = extractVisitItems(first);
  const totalPages =
    typeof first?.totalPages === "number" ? Number(first.totalPages) : 1;

  for (let p = 1; p < totalPages && p < maxPages; p++) {
    const next = await doctorVisitLog({
      doctorId: args.doctorId,
      page: p,
      size,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    });
    all = all.concat(extractVisitItems(next));
  }

  const totalElements =
    typeof first?.totalElements === "number"
      ? Number(first.totalElements)
      : all.length;

  return { total: totalElements, items: all };
}

function pageCard(extra?: string) {
  return [
    "rounded-[28px] border border-zinc-200/80 bg-white shadow-sm shadow-zinc-200/40",
    extra ?? "",
  ].join(" ");
}

function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={pageCard(`p-5 md:p-6 ${className}`)}>
      {title ? (
        <div className="mb-4">
          <div className="text-[1.05rem] font-semibold tracking-tight text-zinc-900">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      {children}
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
      <div className="rounded-[24px] border border-dashed border-zinc-200 bg-[linear-gradient(180deg,rgba(250,250,250,0.95),rgba(244,244,245,0.7))] px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-200 bg-violet-50 text-2xl shadow-sm">
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
                className="rounded-2xl border border-zinc-200/80 bg-white/85 px-5 py-5 text-left shadow-sm shadow-zinc-200/30"
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

function KpiCard({
  label,
  value,
  helper,
  helperTone = "default",
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  helperTone?: "default" | "warning";
}) {
  return (
    <div className={pageCard("relative h-full overflow-hidden p-5")}>
      <div className="absolute inset-x-0 top-0 h-1 bg-violet-500/80" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-4 break-words text-[2rem] font-semibold leading-none tracking-tight text-zinc-950">
        {value}
      </div>
      <div
        className={`mt-4 text-sm ${
          helperTone === "warning" ? "text-amber-600" : "text-zinc-500"
        }`}
      >
        {helper ?? "—"}
      </div>
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white">
      {children}
    </div>
  );
}

function TableHeadCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 ${className}`}
    >
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
    <td
      className={`px-4 py-3.5 align-top break-words text-zinc-700 ${className}`}
    >
      {children}
    </td>
  );
}

function DataTableCard({
  title,
  subtitle,
  columns,
  rows,
  emptyText,
  expanded,
  onToggleExpanded,
  tableClassName = "",
  colGroup,
}: {
  title: string;
  subtitle?: string;
  columns: Array<{ key: string; label: string; className?: string }>;
  rows: Array<Record<string, React.ReactNode>>;
  emptyText: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  tableClassName?: string;
  colGroup?: React.ReactNode;
}) {
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  const canExpand = rows.length > 5;

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <TableShell>
        <table className={`w-full text-sm ${tableClassName}`}>
          {colGroup}
          <thead className="bg-zinc-50/90">
            <tr>
              {columns.map((col) => (
                <TableHeadCell key={col.key} className={col.className ?? ""}>
                  {col.label}
                </TableHeadCell>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {visibleRows.length > 0 ? (
              visibleRows.map((row, idx) => (
                <tr
                  key={String(row.__key ?? idx)}
                  className="align-top transition hover:bg-zinc-50/60"
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className ?? ""}>
                      {row[col.key]}
                    </TableCell>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-sm text-zinc-500"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>

      {canExpand ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            {expanded ? "Show less" : "See more"}
          </button>
        </div>
      ) : null}
    </SectionCard>
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
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 break-words text-zinc-800">{value}</div>
    </div>
  );
}

export function HoDoctorsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const doctorId = readIntParam(sp, "doctorId");
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
  const [territory, setTerritory] = React.useState<string>("ALL");
  const [searchOpen, setSearchOpen] = React.useState<boolean>(!doctorId);
  const [showAllProducts, setShowAllProducts] = React.useState<boolean>(false);
  const [showAllVisits, setShowAllVisits] = React.useState<boolean>(false);

  React.useEffect(() => {
    setSearchOpen(!doctorId);
  }, [doctorId]);

  React.useEffect(() => {
    setShowAllProducts(false);
    setShowAllVisits(false);
  }, [doctorId, territory, period, dateFrom, dateTo]);

  const detailsQ = useQuery({
    queryKey: ["hoDoctorDetails", doctorId ?? "none", stableStringify(filters)],
    queryFn: () => doctorDetails(doctorId as number, filters),
    enabled: typeof doctorId === "number" && doctorId > 0,
    staleTime: 120_000,
  });

  React.useEffect(() => {
    if (!doctorId) return;
    const err = detailsQ.error as any;
    if (isApiError(err) && err.status === 404) {
      setNotFoundMsg(`Doctor not found (id=${doctorId}).`);
      router.replace(
        buildUrlWithParams(pathname, sp, { doctorId: null, page: null }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsQ.error]);

  const logQ = useQuery({
    queryKey: [
      "hoDoctorVisitLogAll",
      doctorId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    queryFn: () =>
      fetchAllDoctorVisitLog({
        doctorId: doctorId as number,
        dateFrom: range?.dateFrom,
        dateTo: range?.dateTo,
        pageSize: 50,
        maxPages: 20,
      }),
    enabled: typeof doctorId === "number" && doctorId > 0 && !!range,
    staleTime: 60_000,
  });

  const { fetchOptions, lastErr: lookupErr } = useCachedTypeahead({
    keyPrefix: ["hoLookup", "doctors"],
    fetcher: lookupDoctors,
    map: (d: any) => ({
      key: String(d.id),
      label: `${String(d.name ?? d.code ?? "Doctor")} (ID ${d.id})`,
      value: Number(d.id),
    }),
    staleTimeMs: 120_000,
  });

  const onSelectDoctor = (id: number) => {
    setNotFoundMsg(null);
    setTerritory("ALL");
    setSearchOpen(false);
    router.replace(
      buildUrlWithParams(pathname, sp, {
        doctorId: id,
      }),
    );
  };

  const onFilters = (next: DrilldownFilters) => {
    setNotFoundMsg(null);
    setTerritory("ALL");
    router.replace(
      buildUrlWithParams(pathname, sp, {
        period: next.period,
        dateFrom: next.period === "CUSTOM" ? (next.dateFrom ?? null) : null,
        dateTo: next.period === "CUSTOM" ? (next.dateTo ?? null) : null,
      }),
    );
  };

  const err: ApiError | null =
    (detailsQ.error as any) || (logQ.error as any) || null;

  const detailsRow = pickFirstRow(detailsQ.data);
  const doctorName =
    pickStr(detailsRow, ["doctorName", "name"]) ??
    (doctorId ? `Doctor #${doctorId}` : "Doctor");

  const allVisits = React.useMemo(() => {
    return logQ.data?.items ?? [];
  }, [logQ.data]);

  const filteredVisits =
    territory === "ALL"
      ? allVisits
      : allVisits.filter((x: any) => {
          const t =
            pickStr(x, ["routeName", "territory", "territoryName"]) ?? "";
          return t === territory;
        });

  const visitTrend = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of filteredVisits) {
      const d =
        toIsoDateOrNull(
          pickStr(it, ["callDate", "date", "call_date", "visitedOn"]),
        ) ?? "";
      if (!d) continue;
      const k = isoWeekKey(d) ?? d.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([x, y]) => ({ x, y }));
  }, [filteredVisits]);

  const productMix = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of filteredVisits) {
      const codesRaw =
        (Array.isArray(it?.productCodes) && it.productCodes) ||
        (Array.isArray(it?.productsDetailed) && it.productsDetailed) ||
        (Array.isArray(it?.products) && it.products) ||
        [];
      const uniq = new Set<string>(
        codesRaw.map((x: any) => String(x ?? "").trim()).filter(Boolean),
      );
      for (const p of uniq) m.set(p, (m.get(p) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [filteredVisits]);

  const territories = React.useMemo(() => {
    const set = new Set<string>();
    for (const it of allVisits) {
      const t = pickStr(it, ["routeName", "territory", "territoryName"]) ?? "";
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allVisits]);

  const summaryVisitCount =
    typeof detailsRow?.visitCount === "number" ? detailsRow.visitCount : null;
  const totalVisits =
    logQ.error || !logQ.data ? (summaryVisitCount ?? 0) : filteredVisits.length;

  const lastVisit = React.useMemo(() => {
    let best: any | null = null;
    for (const it of filteredVisits) {
      const d = toIsoDateOrNull(
        pickStr(it, ["callDate", "date", "call_date", "visitedOn"]),
      );
      if (!d) continue;
      if (!best) best = it;
      else {
        const bd = toIsoDateOrNull(
          pickStr(best, ["callDate", "date", "call_date", "visitedOn"]),
        );
        if (!bd || d > bd) best = it;
      }
    }
    return best;
  }, [filteredVisits]);

  const lastVisitDateFallback = pickStr(detailsRow, ["lastVisitDate"]) ?? null;

  const avgPerMonth = React.useMemo(() => {
    const df = range?.dateFrom ?? "";
    const dt = range?.dateTo ?? "";
    if (!df || !dt) return null;
    const days = daysBetweenInclusive(df, dt);
    const months = Math.max(1, days / 30);
    return (totalVisits / months).toFixed(1);
  }, [range?.dateFrom, range?.dateTo, totalVisits]);

  const productRows = React.useMemo(() => {
    const m = new Map<string, { code: string; calls: number; last: string }>();
    for (const it of filteredVisits) {
      const d =
        toIsoDateOrNull(
          pickStr(it, ["callDate", "date", "call_date", "visitedOn"]),
        ) ?? "";

      const codesRaw =
        (Array.isArray(it?.productCodes) && it.productCodes) ||
        (Array.isArray(it?.productsDetailed) && it.productsDetailed) ||
        (Array.isArray(it?.products) && it.products) ||
        [];

      const codes = codesRaw
        .map((x: any) => String(x ?? "").trim())
        .filter(Boolean);

      for (const p of codes) {
        const cur = m.get(p);
        if (!cur) m.set(p, { code: p, calls: 1, last: d });
        else {
          cur.calls += 1;
          if (d && (!cur.last || d > cur.last)) cur.last = d;
        }
      }
    }
    return Array.from(m.values()).sort(
      (a, b) => b.calls - a.calls || a.code.localeCompare(b.code),
    );
  }, [filteredVisits]);

  const sortedVisits = React.useMemo(() => {
    return filteredVisits
      .slice()
      .sort((a: any, b: any) => {
        const ad =
          toIsoDateOrNull(pickStr(a, ["callDate", "date", "call_date"])) ?? "";
        const bd =
          toIsoDateOrNull(pickStr(b, ["callDate", "date", "call_date"])) ?? "";
        return bd.localeCompare(ad);
      });
  }, [filteredVisits]);

  const productTableRows = React.useMemo(() => {
    return productRows.map((r) => ({
      __key: r.code,
      product: (
        <span className="block break-words font-mono text-[13px] text-zinc-800">
          {r.code}
        </span>
      ),
      calls: r.calls,
      lastDetailed: r.last || "—",
    }));
  }, [productRows]);

  const visitTableRows = React.useMemo(() => {
    return sortedVisits.map((it: any, idx: number) => {
      const d =
        toIsoDateOrNull(pickStr(it, ["callDate", "date", "call_date"])) ?? "—";
      const rep = pickStr(it, ["repUsername", "repName", "rep"]) ?? "—";
      const terr =
        pickStr(it, ["routeName", "territory", "territoryName"]) ?? "—";
      const codesRaw =
        (Array.isArray(it?.productCodes) && it.productCodes) ||
        (Array.isArray(it?.productsDetailed) && it.productsDetailed) ||
        (Array.isArray(it?.products) && it.products) ||
        [];
      const codes = codesRaw
        .map((x: any) => String(x ?? "").trim())
        .filter(Boolean)
        .join(", ");

      return {
        __key: String(it?.callId ?? idx),
        date: d,
        rep,
        territory: terr,
        productsDetailed: codes || "—",
        remark: <span className="text-zinc-400">—</span>,
      };
    });
  }, [sortedVisits]);

  const productMixRows = React.useMemo(() => {
    const topRows = productMix.slice(0, 8);
    const maxValue = Math.max(1, ...topRows.map((r) => r.value));

    return topRows.map((row) => ({
      ...row,
      widthPct: `${Math.max(6, (row.value / maxValue) * 100)}%`,
    }));
  }, [productMix]);

  return (
    <div className="w-full bg-[#f6f7fb]">
      <div className="w-full px-2 py-6 md:px-4">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-900">
              Doctors
            </h1>
            <div className="mt-1 text-sm text-zinc-600">
              Search and drill into doctor analytics with a unified dashboard
              layout.
            </div>
          </div>

          <Link
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            href="/ho"
          >
            Back
          </Link>
        </div>

        {err && <ApiErrorBanner err={err} />}

        {notFoundMsg ? (
          <div className="mb-4">
            <EmptyCard
              title={notFoundMsg}
              body="Try searching again or enter another ID."
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.9fr]">
          <SectionCard
            title="Search"
            subtitle="Find a doctor by name or enter a direct doctor ID."
          >
            {!doctorId || searchOpen ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4">
                  <SimpleTypeahead<number>
                    key={
                      searchOpen ? "doctor-search-open" : "doctor-search-closed"
                    }
                    label="Doctor"
                    placeholder="Type a name…"
                    fetchOptions={fetchOptions}
                    onSelect={(opt) => onSelectDoctor(opt.value)}
                  />
                </div>

                {lookupErr ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                    Lookup unavailable:{" "}
                    <span className="font-mono">{lookupErr.status}</span>{" "}
                    <span className="font-mono">{lookupErr.code}</span>.
                  </div>
                ) : null}

                <div>
                  <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Or enter doctor ID
                  </div>
                  <input
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
                    type="number"
                    min={1}
                    value={doctorId ?? ""}
                    placeholder="e.g. 12"
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (!v) {
                        router.replace(
                          buildUrlWithParams(pathname, sp, {
                            doctorId: null,
                            page: 0,
                          }),
                        );
                      } else {
                        onSelectDoctor(v);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                    Selected doctor
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold text-zinc-900">
                    {doctorName}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">ID #{doctorId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Change
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Filters"
            subtitle="Keep the existing period and date logic unchanged."
          >
            <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4">
              <DrilldownFilterBar
                value={rawFilters}
                onChange={onFilters}
                isFetching={detailsQ.isFetching}
              />
            </div>
          </SectionCard>
        </div>

        <div className="mt-5">
          {detailsQ.isLoading && doctorId ? (
            <div className={pageCard("p-6")}>
              <SkeletonBox lines={3} />
            </div>
          ) : null}

          {!doctorId ? (
            <EmptySelectionState
              accentGlyph="D"
              accentLabel="Doctor detail"
              title="No doctor selected"
              body="Search for a doctor by name or enter a doctor ID to view profile details, visit trends, and product activity for the selected doctor."
              tiles={[
                {
                  title: "Search",
                  body: "Find a doctor quickly by typing a name into the lookup field above.",
                },
                {
                  title: "Filter",
                  body: "Adjust the current period or switch to a custom date range before drilling down.",
                },
                {
                  title: "Analyze",
                  body: "Review profile data, visit history, and promoted product activity once a doctor is selected.",
                },
              ]}
            />
          ) : null}

          {doctorId ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Doctor"
                  value={doctorName}
                  helper={
                    <>
                      ID <span className="font-mono">#{doctorId}</span>
                    </>
                  }
                />

                <KpiCard
                  label="Total Visits"
                  value={totalVisits}
                  helper={
                    territory !== "ALL"
                      ? "In selected window for selected territory."
                      : "In selected window across all territories."
                  }
                />

                <KpiCard
                  label="Avg Visits / Month"
                  value={avgPerMonth ?? "—"}
                  helper="Target: 4 / month"
                  helperTone="warning"
                />

                <KpiCard
                  label="Last Visit"
                  value={
                    toIsoDateOrNull(
                      pickStr(lastVisit, ["callDate", "date", "call_date"]),
                    ) ??
                    lastVisitDateFallback ??
                    "—"
                  }
                  helper={
                    pickStr(lastVisit, ["repUsername", "repName", "rep"])
                      ? `By ${pickStr(lastVisit, ["repUsername", "repName", "rep"])}`
                      : "—"
                  }
                />
              </div>

              <div className="mt-4">
                <SectionCard
                  title="Doctor Profile"
                  subtitle="Basic data from the selected doctor"
                >
                  <div className="space-y-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-medium text-zinc-600">
                        Territory filter
                      </div>
                      <div className="w-full sm:w-56">
                        <select
                          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100"
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <DetailStat
                        label="Assigned reps"
                        value={
                          Array.from(
                            new Set(
                              filteredVisits
                                .map((x: any) =>
                                  pickStr(x, ["repUsername", "repName", "rep"]),
                                )
                                .filter(Boolean) as string[],
                            ),
                          )
                            .slice(0, 6)
                            .join(", ") || "—"
                        }
                      />

                      <DetailStat
                        label="Specialty"
                        value={pickStr(detailsRow, ["specialty"]) ?? "—"}
                      />

                      <DetailStat
                        label="Grade"
                        value={pickStr(detailsRow, ["grade"]) ?? "—"}
                      />

                      <DetailStat
                        label="Status"
                        value={pickStr(detailsRow, ["status"]) ?? "—"}
                      />
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                  title="Visits Over Time"
                  subtitle="Based on visit log in the selected window"
                >
                  <div className="mt-1 overflow-hidden rounded-2xl">
                    {logQ.isLoading ? (
                      <SkeletonBox lines={6} />
                    ) : visitTrend.length === 0 ? (
                      <EmptyCard title="No visits in window" />
                    ) : (
                      <MiniLineChart points={visitTrend} />
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Product Mix" subtitle="Unique products per call">
                  {logQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : productMixRows.length === 0 ? (
                    <EmptyCard title="No products in window" />
                  ) : (
                    <div className="space-y-4">
                      {productMixRows.map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[minmax(0,1fr)_40px] gap-3"
                        >
                          <div className="min-w-0">
                            <div className="mb-1.5 break-words text-xs font-medium uppercase tracking-wide text-zinc-500">
                              {row.label}
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-violet-600"
                                style={{ width: row.widthPct }}
                              />
                            </div>
                          </div>
                          <div className="flex items-end justify-end text-sm font-medium text-zinc-600">
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="mt-4">
                <DataTableCard
                  title="Products Promoted to This Doctor"
                  subtitle="Derived from visit log in the selected window"
                  columns={[
                    { key: "product", label: "Product" },
                    { key: "calls", label: "Calls" },
                    { key: "lastDetailed", label: "Last Detailed" },
                  ]}
                  rows={productTableRows}
                  emptyText="No product detailing found in this window."
                  expanded={showAllProducts}
                  onToggleExpanded={() => setShowAllProducts((v) => !v)}
                  tableClassName="table-fixed"
                  colGroup={
                    <colgroup>
                      <col className="w-[50%]" />
                      <col className="w-[20%]" />
                      <col className="w-[30%]" />
                    </colgroup>
                  }
                />
              </div>

              <div className="mt-4">
                {logQ.isLoading ? <SkeletonBox lines={8} /> : null}

                {!logQ.isLoading && logQ.error ? (
                  isApiError(logQ.error) ? (
                    <ApiErrorBanner err={logQ.error} />
                  ) : (
                    <EmptyCard title="Failed to load visit log" />
                  )
                ) : null}

                {!logQ.isLoading && !logQ.error ? (
                  <DataTableCard
                    title="Visit Log – This Doctor"
                    subtitle="Visits in selected window (newest first)"
                    columns={[
                      { key: "date", label: "Date" },
                      { key: "rep", label: "Rep" },
                      { key: "territory", label: "Territory" },
                      { key: "productsDetailed", label: "Products Detailed" },
                      { key: "remark", label: "Remark" },
                    ]}
                    rows={visitTableRows}
                    emptyText="No visits in this window."
                    expanded={showAllVisits}
                    onToggleExpanded={() => setShowAllVisits((v) => !v)}
                    tableClassName="table-fixed"
                    colGroup={
                      <colgroup>
                        <col className="w-[14%]" />
                        <col className="w-[18%]" />
                        <col className="w-[18%]" />
                        <col className="w-[34%]" />
                        <col className="w-[16%]" />
                      </colgroup>
                    }
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}