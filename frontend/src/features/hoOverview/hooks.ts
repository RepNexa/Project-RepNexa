import { useQuery } from "@tanstack/react-query";
import type { CompanyOverviewFilters } from "./types";
import { postCompanyOverview, getRoutesLookup } from "./api";
import { stableStringify } from "./normalize";

export function useCompanyOverview(filters: CompanyOverviewFilters) {
  const key = stableStringify(filters);
  return useQuery({
    queryKey: ["analytics", "companyOverview", key],
    queryFn: () => postCompanyOverview(filters),
    // Milestone 6 policy: cache 60–120s (SWR-ish refresh behavior).
    staleTime: 90 * 1000,
    // POST query should not retry by default (avoid duplicate POSTs).
    retry: 0,
    refetchOnWindowFocus: true,
  });
}

export function useRoutesLookup() {
  return useQuery({
    queryKey: ["lookup", "routes"],
    queryFn: () => getRoutesLookup(),
    staleTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
