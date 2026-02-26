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
import { doctorDetails, doctorVisitLog, lookupDoctors } from "./api";
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
  // Hard cap to avoid VALIDATION_ERROR from backend paging validators.
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

  const detailsQ = useQuery({
    queryKey: ["hoDoctorDetails", doctorId ?? "none", stableStringify(filters)],
    queryFn: () => doctorDetails(doctorId as number, filters),
    enabled: typeof doctorId === "number" && doctorId > 0,
    staleTime: 120_000,
  });

  // 404 => show not found and clear selection
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
      // MUST include period/range or THIS_MONTH/LAST_MONTH will share the same key.
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
    // group by ISO week (better than monthly for sparse seed data)
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

  // Prefer server summary count (doctor-details) for KPI accuracy even if visit-log fails.
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
    return Array.from(m.values())
      .sort((a, b) => b.calls - a.calls || a.code.localeCompare(b.code))
      .slice(0, 30);
  }, [filteredVisits]);

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Doctors</h1>
          <div className="text-sm text-zinc-600">
            Search and drill into doctor analytics (Milestone 7). Backend scope
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

      {notFoundMsg ? (
        <EmptyCard
          title={notFoundMsg}
          body="Try searching again or enter another ID."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium">Search</div>
          <SimpleTypeahead<number>
            label="Doctor"
            placeholder="Type a name…"
            fetchOptions={fetchOptions}
            onSelect={(opt) => onSelectDoctor(opt.value)}
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
            <div className="text-xs text-zinc-600">Or enter Doctor ID</div>
            <input
              className="mt-1 h-10 w-full rounded border px-2"
              type="number"
              min={1}
              value={doctorId ?? ""}
              placeholder="e.g. 12"
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                if (!v)
                  router.replace(
                    buildUrlWithParams(pathname, sp, {
                      doctorId: null,
                      page: 0,
                    }),
                  );
                else onSelectDoctor(v);
              }}
            />
            <div className="mt-2 text-xs text-zinc-500">
              If lookups return 500 in your backend, the typeahead will show no
              options; ID input still works.
            </div>
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

      <div className="mt-4">
        {detailsQ.isLoading && doctorId ? <SkeletonBox lines={3} /> : null}
        {!doctorId ? (
          <EmptyCard
            title="No doctor selected"
            body="Use the search box or enter a doctor ID."
          />
        ) : null}

        {doctorId ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Doctor</div>
                <div className="mt-1 text-2xl font-semibold">{doctorName}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  ID <span className="font-mono">#{doctorId}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Total Visits</div>
                <div className="mt-1 text-3xl font-semibold">{totalVisits}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  In selected window (filtered by territory if set).
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Avg Visits / Month</div>
                <div className="mt-1 text-3xl font-semibold">
                  {avgPerMonth ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Target: 4 / month (prototype)
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-zinc-600">Last Visit</div>
                <div className="mt-1 text-3xl font-semibold">
                  {toIsoDateOrNull(
                    pickStr(lastVisit, ["callDate", "date", "call_date"]),
                  ) ?? "—"}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {pickStr(lastVisit, ["repUsername", "repName", "rep"]) ? (
                    <>
                      By {pickStr(lastVisit, ["repUsername", "repName", "rep"])}
                    </>
                  ) : (
                    " "
                  )}
                </div>
              </div>
            </div>

            {/* Charts (MVP) */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-2 font-semibold">Visits Over Time</div>
                <div className="text-sm text-zinc-600">
                  Based on visit log in selected window.
                </div>
                <div className="mt-3">
                  {logQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : visitTrend.length === 0 ? (
                    <EmptyCard title="No visits in window" />
                  ) : (
                    <MiniLineChart points={visitTrend} />
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-2 font-semibold">Product Mix</div>
                <div className="text-sm text-zinc-600">
                  Unique products per call (MVP approximation).
                </div>
                <div className="mt-3">
                  {logQ.isLoading ? (
                    <SkeletonBox lines={6} />
                  ) : productMix.length === 0 ? (
                    <EmptyCard title="No products in window" />
                  ) : (
                    <MiniHBarChart rows={productMix} maxRows={8} />
                  )}
                </div>
              </div>
            </div>

            {/* Panels */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">Doctor Profile</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Basic data (best-effort from current backend response).
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Territory filter</div>
                    <div className="w-56">
                      <select
                        className="h-9 w-full rounded border px-2"
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

                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Assigned reps</div>
                    <div className="text-right">
                      {Array.from(
                        new Set(
                          filteredVisits
                            .map((x: any) =>
                              pickStr(x, ["repUsername", "repName", "rep"]),
                            )
                            .filter(Boolean) as string[],
                        ),
                      )
                        .slice(0, 6)
                        .join(", ") || "—"}
                    </div>
                  </div>

                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Specialty</div>
                    <div className="text-right">
                      {pickStr(detailsRow, ["specialty"]) ?? "—"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Grade</div>
                    <div className="text-right">
                      {pickStr(detailsRow, ["grade"]) ?? "—"}
                    </div>
                  </div>
                  <div className="flex justify-between gap-3">
                    <div className="text-zinc-600">Status</div>
                    <div className="text-right">
                      {pickStr(detailsRow, ["status"]) ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="font-semibold">
                  Products Promoted to This Doctor
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Derived from visit log in selected window.
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
                          <td className="p-2">{r.last || "—"}</td>
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

            {/* Visit log */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="font-semibold">Visit Log – This Doctor</div>
              <div className="mt-1 text-sm text-zinc-600">
                Visits in selected window (newest-first).
              </div>

              {logQ.isLoading ? <SkeletonBox lines={8} /> : null}
              {!logQ.isLoading && logQ.error ? (
                isApiError(logQ.error) ? (
                  <ApiErrorBanner err={logQ.error} />
                ) : (
                  <EmptyCard title="Failed to load visit log" />
                )
              ) : null}

              {!logQ.isLoading && !logQ.error ? (
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
                      {filteredVisits
                        .slice()
                        .sort((a: any, b: any) => {
                          const ad =
                            toIsoDateOrNull(
                              pickStr(a, ["callDate", "date", "call_date"]),
                            ) ?? "";
                          const bd =
                            toIsoDateOrNull(
                              pickStr(b, ["callDate", "date", "call_date"]),
                            ) ?? "";
                          return bd.localeCompare(ad);
                        })
                        .slice(0, 80)
                        .map((it: any, idx: number) => {
                          const d =
                            toIsoDateOrNull(
                              pickStr(it, ["callDate", "date", "call_date"]),
                            ) ?? "—";
                          const rep =
                            pickStr(it, ["repUsername", "repName", "rep"]) ??
                            "—";
                          const terr =
                            pickStr(it, [
                              "routeName",
                              "territory",
                              "territoryName",
                            ]) ?? "—";
                          const codesRaw =
                            (Array.isArray(it?.productCodes) &&
                              it.productCodes) ||
                            (Array.isArray(it?.productsDetailed) &&
                              it.productsDetailed) ||
                            (Array.isArray(it?.products) && it.products) ||
                            [];
                          const codes = codesRaw
                            .map((x: any) => String(x ?? "").trim())
                            .filter(Boolean)
                            .join(", ");
                          return (
                            <tr
                              key={String(it?.callId ?? idx)}
                              className="border-t"
                            >
                              <td className="p-2">{d}</td>
                              <td className="p-2">{rep}</td>
                              <td className="p-2">{terr}</td>
                              <td className="p-2">{codes || "—"}</td>
                              <td className="p-2 text-zinc-500">—</td>
                            </tr>
                          );
                        })}
                      {filteredVisits.length === 0 ? (
                        <tr className="border-t">
                          <td className="p-2 text-zinc-600" colSpan={5}>
                            No visits in this window.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="mt-2 text-xs text-zinc-500">
                Showing up to 80 rows. Loaded rows: {filteredVisits.length}.
              </div>
            </div>

            {/* Debug */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-zinc-600">
                Debug: raw responses
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">doctor-details</div>
                  <RawJson data={detailsQ.data} />
                </div>
                <div className="rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium">visit-log</div>
                  <RawJson data={logQ.data} />
                </div>
              </div>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
