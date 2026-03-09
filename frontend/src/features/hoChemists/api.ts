import { apiFetch } from "@/src/lib/api/client";
import type { DrilldownFilters } from "@/src/features/hoDrilldowns/common/types";

export type LookupChemist = { id: number; name?: string; code?: string };

export async function lookupChemists(q: string): Promise<LookupChemist[]> {
  const qs = `?q=${encodeURIComponent(q)}&limit=10`;
  return apiFetch<LookupChemist[]>(`/analytics/lookup/chemists${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function chemistDetails(
  chemistId: number,
  filters: DrilldownFilters,
): Promise<any> {
  // Backend supports: period (THIS_MONTH/LAST_MONTH/CUSTOM), dateFrom/dateTo (only for CUSTOM),
  // plus optional routeIds/fieldManagerId.
  const body: any = { chemistId, period: filters.period };
  if (filters.period === "CUSTOM") {
    body.dateFrom = filters.dateFrom ?? null;
    body.dateTo = filters.dateTo ?? null;
  }
  return apiFetch<any>(`/analytics/chemist-details`, {
    method: "POST",
    body,
  });
}

export type ChemistVisitLogItem = {
  visitId: number;
  visitDate: string; // YYYY-MM-DD
  routeId: number;
  routeCode: string;
  routeName: string;
  repUserId: number;
  repUsername: string;
  oosProductCodes: string[];
  lowProductCodes: string[];
};

type Paged<T> = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: T[];
};

export async function chemistVisitLog(args: {
  chemistId: number;
  dateFrom: string;
  dateTo: string;
  page?: number;
  size?: number;
}): Promise<Paged<ChemistVisitLogItem>> {
  const qp = new URLSearchParams();
  qp.set("page", String(args.page ?? 0));
  qp.set("size", String(args.size ?? 50));
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);
  return apiFetch<Paged<ChemistVisitLogItem>>(
    `/analytics/chemists/${args.chemistId}/visit-log?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}
