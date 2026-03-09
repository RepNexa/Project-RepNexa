import { apiFetch } from "@/src/lib/api/client";
import type { DrilldownFilters } from "@/src/features/hoDrilldowns/common/types";

export type LookupProduct = { id: number; code?: string; name?: string };

export async function lookupProducts(q: string): Promise<LookupProduct[]> {
  const qs = `?q=${encodeURIComponent(q)}&limit=10`;
  return apiFetch<LookupProduct[]>(`/lookup/products${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function productDetails(
  productId: number,
  filters: DrilldownFilters,
): Promise<any> {
  // Backend supports: period (THIS_MONTH/LAST_MONTH/CUSTOM), dateFrom/dateTo (only for CUSTOM),
  // plus optional routeIds/fieldManagerId.
  const body: any = { productId, period: filters.period };
  if (filters.period === "CUSTOM") {
    body.dateFrom = filters.dateFrom ?? null;
    body.dateTo = filters.dateTo ?? null;
  }
  return apiFetch<any>(`/analytics/product-details`, {
    method: "POST",
    body,
  });
}

export type ProductCallsOverTimePoint = { x: string; y: number };
export type ProductCoverageByGradePoint = { grade: string; count: number };
export type ProductOosChemistRow = {
  chemistId: number;
  chemistName: string;
  routeName: string;
  oosEvents: number;
  lastOosDate: string | null;
};
export type ProductTopDoctorRow = {
  doctorId: number;
  doctorName: string;
  grade?: string | null;
  routeName?: string | null;
  routeCode?: string | null;
  callCount: number;
  lastDetailedDate?: string | null;
};

type Paged<T> = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: T[];
};

export async function productCallsOverTime(args: {
  productId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<ProductCallsOverTimePoint[]> {
  const qp = new URLSearchParams();
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);
  return apiFetch<ProductCallsOverTimePoint[]>(
    `/analytics/products/${args.productId}/calls-over-time?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}

export async function productOosChemists(args: {
  productId: number;
  dateFrom: string;
  dateTo: string;
  page?: number;
  size?: number;
}): Promise<Paged<ProductOosChemistRow>> {
  const qp = new URLSearchParams();
  qp.set("page", String(args.page ?? 0));
  qp.set("size", String(args.size ?? 10));
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);

  return apiFetch<Paged<ProductOosChemistRow>>(
    `/analytics/products/${args.productId}/oos-chemists?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}

export async function productCoverageByGrade(args: {
  productId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<ProductCoverageByGradePoint[]> {
  const qp = new URLSearchParams();
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);
  return apiFetch<ProductCoverageByGradePoint[]>(
    `/analytics/products/${args.productId}/coverage-by-grade?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}

export async function productTopDoctors(args: {
  productId: number;
  dateFrom: string;
  dateTo: string;
  page?: number;
  size?: number;
}): Promise<Paged<ProductTopDoctorRow>> {
  const qp = new URLSearchParams();
  qp.set("page", String(args.page ?? 0));
  qp.set("size", String(args.size ?? 25));
  qp.set("dateFrom", args.dateFrom);
  qp.set("dateTo", args.dateTo);
  return apiFetch<Paged<ProductTopDoctorRow>>(
    `/analytics/products/${args.productId}/top-doctors?${qp.toString()}`,
    { method: "GET", requireCsrf: false },
  );
}
