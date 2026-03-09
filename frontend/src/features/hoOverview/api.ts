import { apiFetch } from "@/src/lib/api/client";
import type { CompanyOverviewFilters, CompanyOverviewResponse } from "./types";

export async function postCompanyOverview(
  filters: CompanyOverviewFilters,
): Promise<CompanyOverviewResponse> {
  // Backend requires CSRF for POST; apiFetch enforces it.
  return apiFetch<CompanyOverviewResponse>("/analytics/company-overview", {
    method: "POST",
    body: filters,
  });
}

export type LookupRoute = {
  routeId?: number;
  id?: number;
  routeCode?: string;
  code?: string;
  routeName?: string;
  name?: string;
};

export async function getRoutesLookup(): Promise<LookupRoute[]> {
  const res = await apiFetch<any>("/lookup/routes", {
    method: "GET",
    requireCsrf: false,
  });
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.items)) return res.items;
  return [];
}
