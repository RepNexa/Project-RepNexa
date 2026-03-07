export type DrilldownPeriod = "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";

export type DrilldownFilters = {
  period: DrilldownPeriod;
  // Only used when period === "CUSTOM"
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
};

export type EffectiveRange = { dateFrom: string; dateTo: string };

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Deterministic ISO week bucket (UTC) for small trend charts.
// Returns "YYYY-Www" (e.g., "2026-W08") or null if input is invalid.
export function isoWeekKey(isoDateStr: string): string | null {
  if (!isoDateStr) return null;
  // Force UTC to avoid TZ edge cases around midnight.
  const d = new Date(`${isoDateStr.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  // ISO week: shift to Thursday of current week.
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Deterministic, client-side date range for all periods.
// We use "today" as dateTo for THIS_MONTH (not end-of-month) to avoid confusing
// "future" ranges and to match common dashboard expectations.
export function effectiveDateRange(
  filters: DrilldownFilters,
  now: Date = new Date(),
): EffectiveRange | null {
  const p = filters.period;
  if (p === "CUSTOM") {
    const df = filters.dateFrom?.trim();
    const dt = filters.dateTo?.trim();
    if (!df || !dt) return null;
    return { dateFrom: df, dateTo: dt };
  }

  if (p === "THIS_MONTH") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: isoDate(from), dateTo: isoDate(now) };
  }

  // LAST_MONTH
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  return { dateFrom: isoDate(from), dateTo: isoDate(to) };
}

export function normalizeDrilldownFilters(
  raw: DrilldownFilters,
): DrilldownFilters {
  const period = raw.period;

  const dateFrom =
    period === "CUSTOM" && raw.dateFrom ? raw.dateFrom.trim() : undefined;
  const dateTo =
    period === "CUSTOM" && raw.dateTo ? raw.dateTo.trim() : undefined;

  return {
    period,
    dateFrom: period === "CUSTOM" && dateFrom && dateTo ? dateFrom : undefined,
    dateTo: period === "CUSTOM" && dateFrom && dateTo ? dateTo : undefined,
  };
}

// Deterministic stringify for stable React Query keys (copied from hoOverview normalize.ts)
export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${parts.join(",")}}`;
}
