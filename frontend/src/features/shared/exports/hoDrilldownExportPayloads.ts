"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import type {
  DrilldownFilters,
  DrilldownPeriod,
} from "@/src/features/hoDrilldowns/common/types";
import { normalizeDrilldownFilters } from "@/src/features/hoDrilldowns/common/types";

/**
 * Centralize report endpoints here so we avoid hard-coding strings across pages.
 * If Phase 1 backend paths differ, edit only this object.
 */
export const HO_REPORT_ENDPOINTS = {
  productDetails: "/api/v1/reports/product-details",
  doctorDetails: "/api/v1/reports/doctor-details",
  chemistDetails: "/api/v1/reports/chemist-details",
  repDetails: "/api/v1/reports/rep-details",
} as const;

type BaseDrilldownExportPayload = {
  period: DrilldownPeriod;
  dateFrom?: string;
  dateTo?: string;
  routeIds?: number[];
  fieldManagerId?: number;
};

export type ProductDetailsExportPayload = BaseDrilldownExportPayload & {
  productId?: number;
};

export type DoctorDetailsExportPayload = BaseDrilldownExportPayload & {
  doctorId?: number;
  grade?: "A" | "B" | "C";
};

export type ChemistDetailsExportPayload = BaseDrilldownExportPayload & {
  chemistId?: number;
};

export type RepDetailsExportPayload = BaseDrilldownExportPayload & {
  repUserId?: number;
};

/**
 * URL aliases are intentionally tolerant because page search-param keys may vary slightly
 * across teams/refactors (e.g., repUserId vs userId, productId vs id).
 * If your pages use different keys, add aliases here rather than changing page code.
 */
const KEY_ALIASES = {
  period: ["period"],
  dateFrom: ["dateFrom", "from"],
  dateTo: ["dateTo", "to"],
  fieldManagerId: ["fieldManagerId", "fmId"],
  routeIds: ["routeIds", "routeId", "routes"],
  productId: ["productId", "id"],
  doctorId: ["doctorId", "id"],
  chemistId: ["chemistId", "id"],
  repUserId: ["repUserId", "userId", "id"],
  grade: ["grade"],
} as const;

export function buildProductDetailsExportPayload(
  sp: ReadonlyURLSearchParams,
): ProductDetailsExportPayload {
  const base = buildBaseDrilldownExportPayload(sp);
  const productId = readPositiveIntByAliases(sp, KEY_ALIASES.productId);
  return {
    ...base,
    ...(productId ? { productId } : {}),
  };
}

export function buildDoctorDetailsExportPayload(
  sp: ReadonlyURLSearchParams,
): DoctorDetailsExportPayload {
  const base = buildBaseDrilldownExportPayload(sp);
  const doctorId = readPositiveIntByAliases(sp, KEY_ALIASES.doctorId);
  const grade = readGradeByAliases(sp, KEY_ALIASES.grade);

  return {
    ...base,
    ...(doctorId ? { doctorId } : {}),
    ...(grade ? { grade } : {}),
  };
}

export function buildChemistDetailsExportPayload(
  sp: ReadonlyURLSearchParams,
): ChemistDetailsExportPayload {
  const base = buildBaseDrilldownExportPayload(sp);
  const chemistId = readPositiveIntByAliases(sp, KEY_ALIASES.chemistId);

  return {
    ...base,
    ...(chemistId ? { chemistId } : {}),
  };
}

export function buildRepDetailsExportPayload(
  sp: ReadonlyURLSearchParams,
): RepDetailsExportPayload {
  const base = buildBaseDrilldownExportPayload(sp);
  const repUserId = readPositiveIntByAliases(sp, KEY_ALIASES.repUserId);

  return {
    ...base,
    ...(repUserId ? { repUserId } : {}),
  };
}

export function buildReportFilename(
  reportKey:
    | "product-details"
    | "doctor-details"
    | "chemist-details"
    | "rep-details",
  format: "csv" | "pdf",
  payload: {
    period?: string;
    productId?: number;
    doctorId?: number;
    chemistId?: number;
    repUserId?: number;
  },
): string {
  const parts: string[] = [reportKey];

  if (payload.period) parts.push(String(payload.period).toLowerCase());

  if (typeof payload.productId === "number")
    parts.push(`product-${payload.productId}`);
  if (typeof payload.doctorId === "number")
    parts.push(`doctor-${payload.doctorId}`);
  if (typeof payload.chemistId === "number")
    parts.push(`chemist-${payload.chemistId}`);
  if (typeof payload.repUserId === "number")
    parts.push(`rep-${payload.repUserId}`);

  return `${parts.join("-")}.${format}`;
}

function buildBaseDrilldownExportPayload(
  sp: ReadonlyURLSearchParams,
): BaseDrilldownExportPayload {
  const rawPeriod = readStringByAliases(sp, KEY_ALIASES.period);
  const period = asPeriod(rawPeriod) ?? "THIS_MONTH";

  const rawFilters: DrilldownFilters = {
    period,
    dateFrom: readStringByAliases(sp, KEY_ALIASES.dateFrom),
    dateTo: readStringByAliases(sp, KEY_ALIASES.dateTo),
  };

  const normalized = normalizeDrilldownFilters(rawFilters);
  const routeIds = readRouteIdsByAliases(sp, KEY_ALIASES.routeIds);
  const fieldManagerId = readPositiveIntByAliases(
    sp,
    KEY_ALIASES.fieldManagerId,
  );

  return {
    period: normalized.period,
    ...(normalized.dateFrom ? { dateFrom: normalized.dateFrom } : {}),
    ...(normalized.dateTo ? { dateTo: normalized.dateTo } : {}),
    ...(routeIds.length > 0 ? { routeIds } : {}),
    ...(fieldManagerId ? { fieldManagerId } : {}),
  };
}

function asPeriod(v: string | undefined): DrilldownPeriod | undefined {
  if (v === "THIS_MONTH" || v === "LAST_MONTH" || v === "CUSTOM") return v;
  return undefined;
}

function readGradeByAliases(
  sp: ReadonlyURLSearchParams,
  keys: readonly string[],
): "A" | "B" | "C" | undefined {
  const raw = readStringByAliases(sp, keys)?.trim().toUpperCase();
  return raw === "A" || raw === "B" || raw === "C" ? raw : undefined;
}

function readStringByAliases(
  sp: ReadonlyURLSearchParams,
  keys: readonly string[],
): string | undefined {
  for (const k of keys) {
    const v = sp.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function readPositiveIntByAliases(
  sp: ReadonlyURLSearchParams,
  keys: readonly string[],
): number | undefined {
  for (const k of keys) {
    const raw = sp.get(k);
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const i = Math.trunc(n);
    if (i > 0) return i;
  }
  return undefined;
}

function readRouteIdsByAliases(
  sp: ReadonlyURLSearchParams,
  keys: readonly string[],
): number[] {
  const out = new Set<number>();

  for (const key of keys) {
    // Repeated params: ?routeIds=1&routeIds=2
    for (const raw of sp.getAll(key)) {
      parseRouteTokenIntoSet(raw, out);
    }

    // Single CSV param: ?routeIds=1,2,3
    const single = sp.get(key);
    if (single) {
      parseRouteTokenIntoSet(single, out);
    }
  }

  return Array.from(out).sort((a, b) => a - b);
}

function parseRouteTokenIntoSet(raw: string, out: Set<number>) {
  const parts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) continue;
    const i = Math.trunc(n);
    if (i > 0) out.add(i);
  }
}
