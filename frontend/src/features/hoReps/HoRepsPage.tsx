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
import {
  MiniHBarChart,
  MiniLineChart,
} from "@/src/features/hoDrilldowns/common/MiniCharts";
import { lookupReps, repDetails, repVisitLog } from "./api";

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

function card(extra?: string) {
  return [
    "rounded-[28px] border border-zinc-200/80 bg-white shadow-sm shadow-zinc-200/40",
    extra ?? "",
  ].join(" ");
}

function statCard(extra?: string) {
  return card(["relative overflow-hidden p-5 md:p-6", extra ?? ""].join(" "));
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
    <section className={card(`p-5 md:p-6 ${className}`)}>
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
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
    <div className={statCard("h-full")}>
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
    <div className={card("p-6 md:p-8")}>
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

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-zinc-200/80 bg-white">
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
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 ${className}`}
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
    <td className={`px-4 py-3.5 align-top break-words text-zinc-700 ${className}`}>
      {children}
    </td>
  );
}

export function HoRepsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const repId = readIntParam(sp, "repId");
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
  const [typeaheadResetKey, setTypeaheadResetKey] = React.useState(0);
  const [showAllActivityRows, setShowAllActivityRows] = React.useState(false);

  const detailsQ = useQuery({
    queryKey: ["hoRepDetails", repId ?? "none", stableStringify(filters)],
    queryFn: () => repDetails(repId as number, filters),
    enabled: typeof repId === "number" && repId > 0,
    staleTime: 120_000,
  });

  const activityQ = useQuery({
    queryKey: [
      "hoRepVisitLog",
      repId ?? "none",
      filters.period,
      range?.dateFrom ?? "",
      range?.dateTo ?? "",
    ],
    enabled: typeof repId === "number" && repId > 0 && !!range,
    queryFn: () =>
      repVisitLog({
        repUserId: repId as number,
        dateFrom: String(range?.dateFrom),
        dateTo: String(range?.dateTo),
        page: 0,
        size: 50,
      }),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!repId) return;
    const err = detailsQ.error as any;
    if (isApiError(err) && err.status === 404) {
      setNotFoundMsg(`Rep not found (id=${repId}).`);
      router.replace(buildUrlWithParams(pathname, sp, { repId: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsQ.error]);

  React.useEffect(() => {
    setShowAllActivityRows(false);
  }, [repId, filters.period, filters.dateFrom, filters.dateTo]);

  const { fetchOptions, lastErr: lookupErr } = useCachedTypeahead({
    keyPrefix: ["hoLookup", "reps"],
    fetcher: lookupReps,
    map: (r: any) => ({
      key: String(r.id),
      label: `${String(r.name ?? r.code ?? "Rep")} (ID ${r.id})`,
      value: Number(r.id),
    }),
    staleTimeMs: 120_000,
  });

  const onSelect = (id: number) => {
    setNotFoundMsg(null);
    setTypeaheadResetKey((k) => k + 1);
    router.replace(buildUrlWithParams(pathname, sp, { repId: id }));
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

  const err: ApiError | null = (detailsQ.error as any) || null;
  const activityErr: ApiError | null = (activityQ.error as any) || null;

  const activityItems = React.useMemo(
    () => activityQ.data?.items ?? [],
    [activityQ.data],
  );

  const weekly = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of activityItems) {
      const d = String(it.callDate ?? "");
      if (!d) continue;
      const k = isoWeekKey(d) ?? d.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([x, y]) => ({ x, y }));
  }, [activityItems]);

  const productMix = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of activityItems) {
      const uniq = new Set<string>((it.productCodes ?? []).map(String));
      for (const p of uniq) {
        if (!p) continue;
        m.set(p, (m.get(p) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [activityItems]);

  const row0 = pickFirstRow(detailsQ.data);
  const repName =
    pickStr(row0, ["repName", "name", "repUsername", "username", "code"]) ??
    (repId ? `Rep #${repId}` : "Rep");

  const totalVisits =
    pickNum(row0, ["visitCount", "totalVisits", "calls", "callCount"]) ?? null;

  const lastVisit =
    pickStr(row0, ["lastVisitDate", "lastCallDate", "lastVisit"]) ?? null;

  const avgPerMonth = React.useMemo(() => {
    const df = range?.dateFrom ?? "";
    const dt = range?.dateTo ?? "";
    if (!df || !dt) return null;

    const da = new Date(df);
    const db = new Date(dt);
    const ms = +db - +da;

    const days = !Number.isFinite(ms)
      ? 1
      : Math.max(1, Math.round(ms / 86400000) + 1);

    const months = Math.max(1, days / 30);
    return (activityItems.length / months).toFixed(1);
  }, [range?.dateFrom, range?.dateTo, activityItems.length]);

  const showExpandedSections =
    typeof repId === "number" && repId > 0 && !detailsQ.isLoading && !detailsQ.error;

  const visibleActivityRows = showAllActivityRows
    ? activityItems
    : activityItems.slice(0, 5);

  const hasMoreActivityRows = activityItems.length > 5;

  return (
    <div className="w-full bg-[#f6f7fb]">
      <div className="w-full px-2 py-6 md:px-4">
        <div className="mb-6">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-900">
              Reps
            </h1>
            <div className="mt-1 text-sm text-zinc-600">
              Search and drill into rep analytics with a unified dashboard
              layout.
            </div>
          </div>
        </div>

        {err && <ApiErrorBanner err={err} />}
        {notFoundMsg ? <EmptyCard title={notFoundMsg} /> : null}

        <div className={card("mb-5 p-5 md:p-6")}>
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-[1.2fr_0.9fr]">
            <div className="relative z-20 min-w-0 border-r-0 xl:border-r xl:border-zinc-200/80 xl:pr-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Search
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4">
                <div className="space-y-4">
                  <SimpleTypeahead<number>
                    key={`rep-typeahead-${typeaheadResetKey}`}
                    label="Rep"
                    placeholder="Type a name…"
                    fetchOptions={fetchOptions}
                    onSelect={(opt) => onSelect(opt.value)}
                  />

                  {lookupErr ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      Lookup unavailable:{" "}
                      <span className="font-mono">{lookupErr.status}</span>{" "}
                      <span className="font-mono">{lookupErr.code}</span>. Use the ID
                      input.
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                      Or enter rep ID
                    </div>
                    <input
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-violet-200"
                      type="number"
                      min={1}
                      value={repId ?? ""}
                      placeholder="e.g. 3"
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        router.replace(
                          buildUrlWithParams(pathname, sp, { repId: v ?? null }),
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-30 min-w-0 pt-5 xl:pt-0 xl:pl-6">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Filters
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4">
                <DrilldownFilterBar
                  value={rawFilters}
                  onChange={onFilters}
                  isFetching={detailsQ.isFetching}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {detailsQ.isLoading ? (
            <div className={card("p-6")}>
              <SkeletonBox lines={7} />
            </div>
          ) : !repId ? (
            <EmptySelectionState
              accentGlyph="R"
              accentLabel="Rep detail"
              title="No rep selected"
              body="Search for a rep by name or enter a rep ID to view profile data, doctor visit trends, product mix, and recent activity for the selected rep."
              tiles={[
                {
                  title: "Search",
                  body: "Use the rep lookup above to quickly find a field rep by name.",
                },
                {
                  title: "Filter",
                  body: "Choose the current period or switch to a custom date range before loading analytics.",
                },
                {
                  title: "Drill down",
                  body: "Review visit history, product coverage, and rep profile metrics once a rep is selected.",
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
                <KpiCard
                  label="Rep"
                  value={repName}
                  helper={
                    <>
                      ID <span className="font-mono">#{repId}</span>
                    </>
                  }
                />

                <KpiCard
                  label="Total Visits"
                  value={totalVisits ?? "—"}
                  helper="From rep details response."
                />

                <KpiCard
                  label="Avg Visits / Month"
                  value={avgPerMonth ?? "—"}
                  helper="Derived from visit log in selected window."
                />

                <KpiCard
                  label="Last Visit"
                  value={lastVisit ?? "—"}
                  helper="From rep details response."
                />
              </div>

              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-zinc-600 hover:text-zinc-800">
                  Debug: raw response
                </summary>
                <div className="mt-3">
                  <RawJson data={detailsQ.data} />
                </div>
              </details>
            </>
          )}
        </div>

        {showExpandedSections ? (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <SectionCard
                title="Doctor Visits Over Time"
                subtitle="Weekly total doctor visits for this rep"
              >
                {activityQ.isLoading ? (
                  <SkeletonBox lines={6} />
                ) : activityErr ? (
                  <ApiErrorBanner err={activityErr} />
                ) : weekly.length === 0 ? (
                  <EmptyCard title="No activity in window" />
                ) : (
                  <MiniLineChart points={weekly} />
                )}
              </SectionCard>

              <SectionCard
                title="Product Mix (This Rep)"
                subtitle="Share of visits including each product"
              >
                {activityQ.isLoading ? (
                  <SkeletonBox lines={6} />
                ) : activityErr ? (
                  <ApiErrorBanner err={activityErr} />
                ) : productMix.length === 0 ? (
                  <EmptyCard title="No products in activity" />
                ) : (
                  <MiniHBarChart rows={productMix} maxRows={8} />
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Activity"
              subtitle="Calls found for this rep in the selected window"
              className="mt-5"
            >
              {activityQ.isLoading ? (
                <SkeletonBox lines={7} />
              ) : activityErr ? (
                <ApiErrorBanner err={activityErr} />
              ) : activityItems.length === 0 ? (
                <EmptyCard
                  title="No activity"
                  body="No calls found for this rep in the selected window."
                />
              ) : (
                <>
                  <TableShell>
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[14%]" />
                        <col className="w-[22%]" />
                        <col className="w-[22%]" />
                        <col className="w-[42%]" />
                      </colgroup>
                      <thead className="bg-zinc-50">
                        <tr>
                          <TableHeadCell>Date</TableHeadCell>
                          <TableHeadCell>Doctor</TableHeadCell>
                          <TableHeadCell>Territory</TableHeadCell>
                          <TableHeadCell>Products Detailed</TableHeadCell>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-700">
                        {visibleActivityRows.map((it) => (
                          <tr
                            key={String(it.callId)}
                            className="border-t border-zinc-200/80 transition hover:bg-zinc-50/70"
                          >
                            <TableCell>{String(it.callDate ?? "—")}</TableCell>
                            <TableCell>
                              {String(it.doctorName ?? `Doctor #${it.doctorId}`)}
                            </TableCell>
                            <TableCell>
                              {String(it.routeName ?? it.routeCode ?? "—")}
                            </TableCell>
                            <TableCell>
                              {(it.productCodes ?? []).length
                                ? String((it.productCodes ?? []).join(", "))
                                : "—"}
                            </TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t border-zinc-200/80 px-4 py-3 text-xs text-zinc-500">
                      Loaded rows: {activityItems.length}
                    </div>
                  </TableShell>

                  {hasMoreActivityRows ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                        onClick={() => setShowAllActivityRows((v) => !v)}
                      >
                        {showAllActivityRows ? "Show less" : "See more"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </SectionCard>
          </>
        ) : null}

        <div className="h-6" />
      </div>
    </div>
  );
}