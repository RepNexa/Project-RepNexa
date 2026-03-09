import { apiFetch } from "@/src/lib/api/client";
import type { DrilldownFilters } from "@/src/features/hoDrilldowns/common/types";

export type LookupRep = { id: number; name?: string; code?: string };

export type RepVisitLogItem = {
  callId: number;
  callDate: string;
  routeId: number;
  routeCode: string;
  routeName: string;
  doctorId: number;
  doctorName: string;
  repUserId: number;
  repUsername: string;
  productCodes: string[];
};

type Paged<T> = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: T[];
};

export async function lookupReps(q: string): Promise<LookupRep[]> {
  const qs = `?q=${encodeURIComponent(q)}&limit=10`;
  return apiFetch<LookupRep[]>(`/analytics/lookup/reps${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function repDetails(
  repId: number,
  filters: DrilldownFilters,
): Promise<any> {
  // Backend expects "repUserId" (not "repId").
  // Send only supported fields to avoid relying on ignoreUnknown behavior.
  const body: any = {
    repUserId: repId,
    period: filters.period,
  };
  if (filters.period === "CUSTOM") {
    body.dateFrom = filters.dateFrom ?? null;
    body.dateTo = filters.dateTo ?? null;
  }
  return apiFetch<any>(`/analytics/rep-details`, {
    method: "POST",
    body,
  });
}

export async function repVisitLog(args: {
  repUserId: number;
  dateFrom: string;
  dateTo: string;
  page?: number;
  size?: number;
}): Promise<Paged<RepVisitLogItem>> {
  const qp = new URLSearchParams();
  qp.set("page", String(args.page ?? 0));
  qp.set("size", String(args.size ?? 50));
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);
  return apiFetch<Paged<RepVisitLogItem>>(
    `/analytics/reps/${args.repUserId}/visit-log?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}
