import type { CompanyOverviewFilters, Grade } from "./types";

function asGrade(v: unknown): Grade | undefined {
  return v === "A" || v === "B" || v === "C" ? v : undefined;
}

function uniqSorted(nums: number[] | undefined): number[] | undefined {
  if (!nums || nums.length === 0) return undefined;
  const set = new Set<number>();
  for (const n of nums) {
    if (typeof n === "number" && Number.isFinite(n)) set.add(n);
  }
  const out = Array.from(set);
  out.sort((a, b) => a - b);
  return out.length ? out : undefined;
}

export function normalizeCompanyOverviewFilters(
  raw: CompanyOverviewFilters,
): CompanyOverviewFilters {
  const period = raw.period;

  const routeIds = uniqSorted(raw.routeIds);
  const grade =
    raw.grade && raw.grade.trim().length > 0 ? raw.grade.trim() : undefined;

  const fieldManagerId =
    typeof raw.fieldManagerId === "number" &&
    Number.isFinite(raw.fieldManagerId)
      ? raw.fieldManagerId
      : undefined;

  // Only include custom range if period=CUSTOM and both dates are present.
  const dateFrom =
    period === "CUSTOM" && raw.dateFrom ? raw.dateFrom.trim() : undefined;
  const dateTo =
    period === "CUSTOM" && raw.dateTo ? raw.dateTo.trim() : undefined;

  const normalized: CompanyOverviewFilters = {
    period,
    routeIds,
    grade: asGrade(grade),
    fieldManagerId,
    dateFrom: period === "CUSTOM" && dateFrom && dateTo ? dateFrom : undefined,
    dateTo: period === "CUSTOM" && dateFrom && dateTo ? dateTo : undefined,
  };

  // Omit empty arrays explicitly
  if (normalized.routeIds && normalized.routeIds.length === 0) {
    delete normalized.routeIds;
  }
  return normalized;
}

// Deterministic stringify for stable React Query keys
export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${parts.join(",")}}`;
}
