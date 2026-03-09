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

function daysBetweenInclusive(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  const ms = +db - +da;
  if (!Number.isFinite(ms)) return 1;
  return Math.max(1, Math.round(ms / 86400000) + 1);
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
    router.replace(buildUrlWithParams(pathname, sp, { repId: id }));
  };

  const onFilters = (next: DrilldownFilters) => {
    setNotFoundMsg(null);
    router.replace(
      buildUrlWithParams(pathname, sp, {
        period: next.period,
        // Prevent "CUSTOM dates stuck in URL" when switching back to THIS_MONTH/LAST_MONTH.
        dateFrom: next.period === "CUSTOM" ? (next.dateFrom ?? null) : null,
        dateTo: next.period === "CUSTOM" ? (next.dateTo ?? null) : null,
      }),
    );
  };

  const err: ApiError | null = (detailsQ.error as any) || null;
  const activityErr: ApiError | null = (activityQ.error as any) || null;

  const activityItems = React.useMemo(() => {
    return activityQ.data?.items ?? [];
  }, [activityQ.data]);

  const weekly = React.useMemo(() => {
    // ISO-week aggregation (UTC-stable) so we get multiple points within a month.
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

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reps</h1>
          <div className="text-sm text-zinc-600">
            Search and drill into rep analytics (Milestone 7). Backend scope
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
            label="Rep"
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
            <div className="text-xs text-zinc-600">Or enter Rep ID</div>
            <input
              className="mt-1 h-10 w-full rounded border px-2"
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
        <div className="mb-2 text-sm font-medium">Rep drilldown</div>
        {detailsQ.isLoading ? (
          <SkeletonBox lines={7} />
        ) : !repId ? (
          <EmptyCard
            title="No rep selected"
            body="Use the search box or enter a rep ID."
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
                <div className="text-xs text-zinc-600">Rep</div>
                <div className="mt-1 text-2xl font-semibold">{repName}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  ID <span className="font-mono">#{repId}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Total Visits</div>
                <div className="mt-1 text-3xl font-semibold">
                  {totalVisits ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  From rep-details (if provided).
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Avg Visits / Month</div>
                <div className="mt-1 text-3xl font-semibold">
                  {avgPerMonth ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Derived from rep visit log in window.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Last Visit</div>
                <div className="mt-1 text-3xl font-semibold">
                  {lastVisit ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  From rep-details.
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Rep Profile</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Best-effort from current backend response.
                </div>
                <div className="mt-3 text-sm text-zinc-700">
                  Activity loaded:{" "}
                  <span className="font-mono">{activityItems.length}</span>{" "}
                  calls in selected window.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Activity</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {activityErr
                    ? "Unavailable (request failed)."
                    : "Available via rep visit log."}
                </div>
              </div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-600">
                Debug: raw response
              </summary>
              <div className="mt-3">
                <RawJson data={detailsQ.data} />
              </div>
            </details>
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium">
            Doctor Visits Over Time
          </div>
          {activityQ.isLoading ? (
            <SkeletonBox lines={6} />
          ) : activityErr ? (
            <ApiErrorBanner err={activityErr} />
          ) : weekly.length === 0 ? (
            <EmptyCard title="No activity in window" />
          ) : (
            <MiniLineChart points={weekly} />
          )}
        </div>
        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium">Product Mix (This Rep)</div>
          {activityQ.isLoading ? (
            <SkeletonBox lines={6} />
          ) : activityErr ? (
            <ApiErrorBanner err={activityErr} />
          ) : productMix.length === 0 ? (
            <EmptyCard title="No products in activity" />
          ) : (
            <MiniHBarChart rows={productMix} maxRows={8} />
          )}
        </div>
      </div>

      <div className="mt-4 rounded border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Activity</div>
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Doctor</th>
                  <th className="px-2 py-2 text-left">Territory</th>
                  <th className="px-2 py-2 text-left">Products Detailed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityItems.map((it) => (
                  <tr key={String(it.callId)}>
                    <td className="px-2 py-2">{String(it.callDate ?? "—")}</td>
                    <td className="px-2 py-2">
                      {String(it.doctorName ?? `Doctor #${it.doctorId}`)}
                    </td>
                    <td className="px-2 py-2">
                      {String(it.routeName ?? it.routeCode ?? "—")}
                    </td>
                    <td className="px-2 py-2">
                      {(it.productCodes ?? []).length
                        ? String((it.productCodes ?? []).join(", "))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-xs text-zinc-500">
              Showing up to {activityQ.data?.size ?? 50} rows. Loaded rows:{" "}
              {activityItems.length}.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
