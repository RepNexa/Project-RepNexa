"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { useCompanyOverview } from "@/src/features/hoOverview/hooks";
import type { CompanyOverviewFilters } from "@/src/features/hoOverview/types";
import { normalizeCompanyOverviewFilters } from "@/src/features/hoOverview/normalize";
import { FilterBar } from "@/src/features/hoOverview/ui/FilterBar";
import { WidgetCard } from "@/src/features/hoOverview/ui/WidgetCard";
import {
  formatNumber,
  formatPercent,
} from "@/src/features/hoOverview/ui/format";
import { SimpleBarList } from "@/src/features/hoOverview/ui/SimpleBarList";
import { RepPerformanceTable } from "@/src/features/hoOverview/ui/RepPerformanceTable";
import { useMeForUi } from "@/src/features/hoOverview/useMeForUi";

const TARGET_REP_COLORS = [
  "bg-violet-600",
  "bg-fuchsia-600",
  "bg-indigo-600",
  "bg-blue-600",
  "bg-sky-600",
  "bg-cyan-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-green-600",
  "bg-lime-600",
  "bg-amber-500",
  "bg-orange-500",
  "bg-rose-600",
  "bg-pink-600",
  "bg-purple-500",
  "bg-blue-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function ShowMoreButton({
  expanded,
  onToggle,
  hiddenCount,
}: {
  expanded: boolean;
  onToggle: () => void;
  hiddenCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-4 inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      {expanded
        ? "Show less"
        : `See more${hiddenCount > 0 ? ` (${hiddenCount} more)` : ""}`}
    </button>
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
      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 ${className}`}
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

function KpiCard({
  label,
  value,
  helper,
  accent = "bg-violet-500",
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-200/30 md:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-tight text-zinc-950 md:text-[2.45rem]">
        {value}
      </div>
      <div className="mt-3 text-sm text-zinc-500">{helper ?? "—"}</div>
    </div>
  );
}

export default function HoCompanyOverviewPage() {
  const { data: me } = useMeForUi();
  const isCM = me?.role === "CM";

  const [filters, setFilters] = useState<CompanyOverviewFilters>({
    period: "THIS_MONTH",
    routeIds: [],
    grade: undefined,
    fieldManagerId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  });

  const [initialPulse, setInitialPulse] = useState(true);
  const [repPerfDetailExpanded, setRepPerfDetailExpanded] = useState(false);
  const [productCoverageExpanded, setProductCoverageExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setInitialPulse(false), 850);
    return () => window.clearTimeout(timer);
  }, []);

  const normalized = useMemo(
    () => normalizeCompanyOverviewFilters(filters),
    [filters],
  );

  const q = useCompanyOverview(normalized);

  const coveragePct = q.data?.coverageSelectedGrade?.value ?? null;
  const coverageDelta = q.data?.coverageSelectedGrade?.deltaVsLastMonth ?? null;
  const visitsTotal = q.data?.visits ?? null;
  const avgVisits = q.data?.avgDoctorVisits ?? null;
  const doctorsAtRisk = q.data?.doctorsAtRisk ?? null;

  const coverageByGrade = q.data?.coverageByGrade ?? [];
  const targetByRep = q.data?.targetAchievementByRep ?? [];
  const repPerfRows = q.data?.repPerformanceTable ?? [];
  const oosByProduct = q.data?.oosByProduct ?? [];
  const oosByTerritory = q.data?.oosByTerritory ?? [];
  const repPerfDetail = q.data?.repPerformanceDetail ?? [];
  const productByGrade = q.data?.productCoverageByGrade ?? [];

  const targetByRepMap = new Map<number, number | null>(
    targetByRep
      .filter((x: any) => typeof x?.repUserId === "number")
      .map((x: any) => [x.repUserId, x.achievement] as const),
  );

  const repPerfForTable = repPerfRows.map((r: any) => ({
    ...r,
    achievementPercent:
      typeof r?.repUserId === "number"
        ? (targetByRepMap.get(r.repUserId) ?? null)
        : null,
  }));

  const repPerfDetailRows = repPerfDetailExpanded
    ? repPerfDetail
    : repPerfDetail.slice(0, 5);

  const productCoverageRows = productCoverageExpanded
    ? productByGrade
    : productByGrade.slice(0, 5);

  const animatedLoading = initialPulse || q.isLoading;

  return (
    <AuthGuard allowedRoles={["FM", "CM"]}>
      <div className="min-h-full bg-[#f6f7fb]">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-5">
          <div className="mb-4 rounded-[28px] border border-zinc-200/80 bg-white px-5 py-3.5 shadow-sm shadow-zinc-200/35 md:px-6 md:py-4">
            <div className="max-w-5xl">
              <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                Dashboard
              </div>
              <h1 className="mt-2.5 text-[1.3rem] font-semibold tracking-tight text-zinc-950 md:text-[1.95rem]">
                Company Overview
              </h1>
              
            </div>

            <div className="mt-3.5 border-t border-zinc-200/80 pt-3.5">
              <FilterBar
                value={filters}
                onChange={setFilters}
                canSelectFieldManager={isCM}
                isFetching={q.isFetching}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <WidgetCard
              title="Summary KPIs"
              loading={q.isLoading}
              error={q.error ? "Failed to load analytics." : undefined}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Coverage %"
                  value={formatPercent(coveragePct)}
                  helper={`Δ vs last month: ${formatPercent(coverageDelta)}`}
                  accent="bg-violet-500"
                />
                <KpiCard
                  label="Doctors at risk"
                  value={formatNumber(doctorsAtRisk)}
                  helper="Need follow-up attention"
                  accent="bg-rose-500"
                />
                <KpiCard
                  label="Visits"
                  value={formatNumber(visitsTotal)}
                  helper="Total activity in selected period"
                  accent="bg-blue-500"
                />
                <KpiCard
                  label="Avg visits"
                  value={formatNumber(avgVisits)}
                  helper="Average doctor visits"
                  accent="bg-emerald-500"
                />
              </div>
            </WidgetCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <WidgetCard
                title="Coverage % by grade"
                loading={animatedLoading}
                error={q.error ? "Failed to load analytics." : undefined}
                empty={!animatedLoading && !q.error && coverageByGrade.length === 0}
                emptyText="No grade coverage data."
                className="xl:col-span-4"
              >
                <SimpleBarList
                  labelMinWidthClassName="min-w-[72px]"
                  items={coverageByGrade.map((x: any) => {
                    const grade = String(x.grade ?? "Unknown");
                    const color =
                      grade === "A"
                        ? "bg-red-500"
                        : grade === "B"
                          ? "bg-blue-500"
                          : grade === "C"
                            ? "bg-green-500"
                            : "bg-zinc-500";

                    return {
                      label: grade,
                      value: typeof x.value === "number" ? x.value : null,
                      format: "percent" as const,
                      colorClassName: color,
                    };
                  })}
                />
              </WidgetCard>

              <WidgetCard
                title="Target achievement by rep"
                loading={animatedLoading}
                error={q.error ? "Failed to load analytics." : undefined}
                empty={!animatedLoading && !q.error && targetByRep.length === 0}
                emptyText="No target achievement data."
                className="xl:col-span-8"
              >
                <SimpleBarList
                  labelMinWidthClassName="min-w-[108px] sm:min-w-[126px]"
                  items={targetByRep.slice(0, 20).map((x: any, idx: number) => ({
                    label: String(x.repUsername ?? "Rep"),
                    value: typeof x.achievement === "number" ? x.achievement : null,
                    format: "percent" as const,
                    colorClassName:
                      TARGET_REP_COLORS[idx] ??
                      TARGET_REP_COLORS[idx % TARGET_REP_COLORS.length],
                  }))}
                />
              </WidgetCard>
            </div>

            <WidgetCard
              title="Rep performance"
              loading={q.isLoading}
              error={q.error ? "Failed to load analytics." : undefined}
              empty={!q.isLoading && !q.error && repPerfRows.length === 0}
              emptyText="No rep performance rows."
            >
              <RepPerformanceTable rows={repPerfForTable} />
            </WidgetCard>

            <WidgetCard
              title="Rep performance detail"
              loading={q.isLoading}
              error={q.error ? "Failed to load analytics." : undefined}
              empty={!q.isLoading && !q.error && repPerfDetail.length === 0}
              emptyText="No rep detail rows."
            >
              <div className="rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[23%]" />
                    <col className="w-[23%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="border-b border-zinc-200 bg-zinc-50/80">
                    <tr>
                      <TableHeadCell>Rep</TableHeadCell>
                      <TableHeadCell>Territory</TableHeadCell>
                      <TableHeadCell className="text-right">Visits</TableHeadCell>
                      <TableHeadCell className="text-right">Doctors</TableHeadCell>
                      <TableHeadCell className="text-right">A</TableHeadCell>
                      <TableHeadCell className="text-right">B</TableHeadCell>
                      <TableHeadCell className="text-right">C</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {repPerfDetailRows.map((r: any, idx: number) => (
                      <tr
                        key={`${String(r.repUserId ?? idx)}-${String(r.territory ?? "")}`}
                        className="border-b border-zinc-100 last:border-b-0"
                      >
                        <TableCell className="font-medium text-zinc-900">
                          <span className="block break-words">
                            {String(r.repUsername ?? "")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="block break-words">
                            {String(r.territory ?? "")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.totalVisits ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.uniqueDoctors ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.aGradeVisits ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.bGradeVisits ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.cGradeVisits ?? null)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {repPerfDetail.length > 5 ? (
                <ShowMoreButton
                  expanded={repPerfDetailExpanded}
                  onToggle={() => setRepPerfDetailExpanded((prev) => !prev)}
                  hiddenCount={Math.max(repPerfDetail.length - 5, 0)}
                />
              ) : null}
            </WidgetCard>

            <WidgetCard
              title="Product coverage by grade"
              loading={q.isLoading}
              error={q.error ? "Failed to load analytics." : undefined}
              empty={!q.isLoading && !q.error && productByGrade.length === 0}
              emptyText="No product-by-grade rows."
            >
              <div className="rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[36%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead className="border-b border-zinc-200 bg-zinc-50/80">
                    <tr>
                      <TableHeadCell>Code</TableHeadCell>
                      <TableHeadCell>Name</TableHeadCell>
                      <TableHeadCell className="text-right">All</TableHeadCell>
                      <TableHeadCell className="text-right">A</TableHeadCell>
                      <TableHeadCell className="text-right">B</TableHeadCell>
                      <TableHeadCell className="text-right">C</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {productCoverageRows.map((p: any, idx: number) => (
                      <tr
                        key={`${String(p.code ?? idx)}-${String(p.name ?? "")}`}
                        className="border-b border-zinc-100 last:border-b-0"
                      >
                        <TableCell className="font-mono text-xs text-zinc-800">
                          <span className="block break-words">
                            {String(p.code ?? "")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="block break-words">
                            {String(p.name ?? "")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.allDoctors ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.aDoctors ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.bDoctors ?? null)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(p.cDoctors ?? null)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {productByGrade.length > 5 ? (
                <ShowMoreButton
                  expanded={productCoverageExpanded}
                  onToggle={() => setProductCoverageExpanded((prev) => !prev)}
                  hiddenCount={Math.max(productByGrade.length - 5, 0)}
                />
              ) : null}
            </WidgetCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <WidgetCard
                title="OOS Events by Product"
                loading={animatedLoading}
                error={q.error ? "Failed to load analytics." : undefined}
                empty={!animatedLoading && !q.error && oosByProduct.length === 0}
                emptyText="No OOS product events."
                className="xl:col-span-6"
              >
                <SimpleBarList
                  labelMinWidthClassName="min-w-[120px] sm:min-w-[150px]"
                  items={oosByProduct.map((x: any) => ({
                    label: String(x.key ?? "Product"),
                    value: typeof x.count === "number" ? x.count : null,
                    format: "number" as const,
                    colorClassName: "bg-violet-500",
                  }))}
                />
                <div className="mt-3 text-xs leading-5 text-zinc-500">
                  Use to decide which products need distribution attention first.
                </div>
              </WidgetCard>

              <WidgetCard
                title="OOS Events by Territory"
                loading={animatedLoading}
                error={q.error ? "Failed to load analytics." : undefined}
                empty={!animatedLoading && !q.error && oosByTerritory.length === 0}
                emptyText="No OOS territory events."
                className="xl:col-span-6"
              >
                <SimpleBarList
                  labelMinWidthClassName="min-w-[120px] sm:min-w-[150px]"
                  items={oosByTerritory.map((x: any) => ({
                    label: String(x.key ?? "Territory"),
                    value: typeof x.count === "number" ? x.count : null,
                    format: "number" as const,
                    colorClassName: "bg-violet-500",
                  }))}
                />
              </WidgetCard>
            </div>
          </div>

          <div className="mt-5 text-xs text-zinc-500">
            Data scope is enforced by the backend. UI filters do not grant extra
            access.
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}