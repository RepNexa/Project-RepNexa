"use client";

import { useMemo, useState } from "react";
import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { useCompanyOverview } from "@/src/features/hoOverview/hooks";
import type { CompanyOverviewFilters } from "@/src/features/hoOverview/types";
import { normalizeCompanyOverviewFilters } from "@/src/features/hoOverview/normalize";
import { FilterBar } from "@/src/features/hoOverview/ui/FilterBar";
import { WidgetCard } from "@/src/features/hoOverview/ui/WidgetCard";
import {
  formatNumber,
  formatPercent,
  safeJson,
} from "@/src/features/hoOverview/ui/format";
import { SimpleBarList } from "@/src/features/hoOverview/ui/SimpleBarList";
import { RepPerformanceTable } from "@/src/features/hoOverview/ui/RepPerformanceTable";
import { useMeForUi } from "@/src/features/hoOverview/useMeForUi";

export default function HoCompanyOverviewPage() {
  const { data: me } = useMeForUi();
  const isCM = me?.role === "CM";

  // UI state (raw; will be normalized for query key + request body)
  const [filters, setFilters] = useState<CompanyOverviewFilters>({
    period: "THIS_MONTH",
    routeIds: [],
    grade: undefined,
    fieldManagerId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  });

  const normalized = useMemo(
    () => normalizeCompanyOverviewFilters(filters),
    [filters],
  );

  const q = useCompanyOverview(normalized);

  // Authoritative mapping to backend CompanyOverviewResponse DTO.
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

  return (
    <AuthGuard allowedRoles={["FM", "CM"]}>
      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Company Overview</h1>
          <div className="text-sm text-zinc-600">
            KPIs and performance widgets (Milestone 6). Values that are missing
            or invalid are shown as <b>N/A</b>.
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-4 border-b bg-white px-4 py-3">
          <FilterBar
            value={filters}
            onChange={setFilters}
            canSelectFieldManager={isCM}
            isFetching={q.isFetching}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <WidgetCard
            title="Summary KPIs"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs text-zinc-600">Coverage %</div>
                <div className="text-lg font-semibold">
                  {formatPercent(coveragePct)}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Δ vs last month: {formatPercent(coverageDelta)}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-zinc-600">Doctors at risk</div>
                <div className="text-lg font-semibold">
                  {formatNumber(doctorsAtRisk)}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-zinc-600">Visits</div>
                <div className="text-lg font-semibold">
                  {formatNumber(visitsTotal)}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-zinc-600">Avg visits</div>
                <div className="text-lg font-semibold">
                  {formatNumber(avgVisits)}
                </div>
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-zinc-700 underline">
                See more
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs">
                {safeJson(q.data)}
              </pre>
            </details>
          </WidgetCard>

          <WidgetCard
            title="Coverage % by grade"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && coverageByGrade.length === 0}
            emptyText="No grade coverage data."
          >
            <SimpleBarList
              items={coverageByGrade.map((x: any) => ({
                label: String(x.grade ?? "Unknown"),
                value: typeof x.value === "number" ? x.value : null,
                format: "percent",
              }))}
            />
          </WidgetCard>

          <WidgetCard
            title="Target achievement by rep"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && targetByRep.length === 0}
            emptyText="No target achievement data."
          >
            <SimpleBarList
              items={targetByRep.slice(0, 12).map((x: any) => ({
                label: String(x.repUsername ?? "Rep"),
                value: typeof x.achievement === "number" ? x.achievement : null,
                format: "percent",
              }))}
            />
            {targetByRep.length > 12 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-700 underline">
                  See more
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs">
                  {safeJson(targetByRep)}
                </pre>
              </details>
            ) : null}
          </WidgetCard>

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
            title="OOS by territory"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && oosByTerritory.length === 0}
            emptyText="No territory OOS data."
          >
            <SimpleBarList
              items={oosByTerritory.map((x: any) => ({
                label: String(x.key ?? "Territory"),
                value: typeof x.count === "number" ? x.count : null,
                format: "number",
              }))}
            />
          </WidgetCard>

          <WidgetCard
            title="Rep performance detail"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && repPerfDetail.length === 0}
            emptyText="No rep detail rows."
          >
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="p-2">Rep</th>
                    <th className="p-2">Territory</th>
                    <th className="p-2">Visits</th>
                    <th className="p-2">Doctors</th>
                    <th className="p-2">A</th>
                    <th className="p-2">B</th>
                    <th className="p-2">C</th>
                  </tr>
                </thead>
                <tbody>
                  {repPerfDetail.slice(0, 25).map((r: any) => (
                    <tr key={String(r.repUserId)} className="border-t">
                      <td className="p-2">{String(r.repUsername ?? "")}</td>
                      <td className="p-2">{String(r.territory ?? "")}</td>
                      <td className="p-2">
                        {formatNumber(r.totalVisits ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(r.uniqueDoctors ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(r.aGradeVisits ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(r.bGradeVisits ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(r.cGradeVisits ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {repPerfDetail.length > 25 ? (
              <div className="mt-2 text-xs text-zinc-500">
                Showing 25 of {repPerfDetail.length}.
              </div>
            ) : null}
          </WidgetCard>

          <WidgetCard
            title="Product coverage by grade"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && productByGrade.length === 0}
            emptyText="No product-by-grade rows."
          >
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="p-2">Code</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">All</th>
                    <th className="p-2">A</th>
                    <th className="p-2">B</th>
                    <th className="p-2">C</th>
                  </tr>
                </thead>
                <tbody>
                  {productByGrade.slice(0, 20).map((p: any) => (
                    <tr key={String(p.code)} className="border-t">
                      <td className="p-2 font-mono">{String(p.code ?? "")}</td>
                      <td className="p-2">{String(p.name ?? "")}</td>
                      <td className="p-2">
                        {formatNumber(p.allDoctors ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(p.aDoctors ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(p.bDoctors ?? null)}
                      </td>
                      <td className="p-2">
                        {formatNumber(p.cDoctors ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetCard>
          <WidgetCard
            title="OOS Events by Product"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && oosByProduct.length === 0}
            emptyText="No OOS product events."
          >
            <SimpleBarList
              items={oosByProduct.map((x: any) => ({
                label: String(x.key ?? "Product"),
                value: typeof x.count === "number" ? x.count : null,
                format: "number",
              }))}
            />
            <div className="mt-2 text-xs text-zinc-500">
              Use to decide which products need distribution attention first.
            </div>
          </WidgetCard>
          <WidgetCard
            title="OOS Events by Territory"
            loading={q.isLoading}
            error={q.error ? "Failed to load analytics." : undefined}
            empty={!q.isLoading && !q.error && oosByTerritory.length === 0}
            emptyText="No OOS territory events."
          >
            <SimpleBarList
              items={oosByTerritory.map((x: any) => ({
                label: String(x.key ?? "Territory"),
                value: typeof x.count === "number" ? x.count : null,
                format: "number",
              }))}
            />
          </WidgetCard>
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          Data scope is enforced by the backend. UI filters do not grant extra
          access.
        </div>
      </div>
    </AuthGuard>
  );
}
