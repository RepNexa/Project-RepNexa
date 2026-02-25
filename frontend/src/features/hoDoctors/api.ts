import { apiFetch } from "@/src/lib/api/client";
import type { DrilldownFilters } from "@/src/features/hoDrilldowns/common/types";

export type LookupDoctor = {
  id: number;
  name?: string;
  code?: string;
  specialty?: string | null;
};

export async function lookupDoctors(q: string): Promise<LookupDoctor[]> {
  const qs = `?q=${encodeURIComponent(q)}&limit=10`;
  return apiFetch<LookupDoctor[]>(`/analytics/lookup/doctors${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function doctorDetails(
  doctorId: number,
  filters: DrilldownFilters,
): Promise<any> {
  return apiFetch<any>(`/analytics/doctor-details`, {
    method: "POST",
    body: { doctorId, ...filters },
  });
}

export async function doctorVisitLog(args: {
  doctorId: number;
  page: number;
  size: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<any> {
  const qp = new URLSearchParams();
  qp.set("page", String(args.page));
  qp.set("size", String(args.size));
  if (args.dateFrom) qp.set("dateFrom", args.dateFrom);
  if (args.dateTo) qp.set("dateTo", args.dateTo);
  return apiFetch<any>(
    `/analytics/doctors/${args.doctorId}/visit-log?${qp.toString()}`,
    {
      method: "GET",
      requireCsrf: false,
    },
  );
}
