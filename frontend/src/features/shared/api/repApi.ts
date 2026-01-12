import { apiFetch } from "@/src/lib/api/client";

export type RepContextRoute = {
  repRouteAssignmentId: number;
  routeId: number;
  routeName: string;
  routeCode: string;
  territoryName: string;
};

export type RepContext = {
  userId: number;
  username: string;
  role: "MR" | "FM" | "CM";
  routes: RepContextRoute[];
};

export async function repContext(): Promise<RepContext> {
  return apiFetch<RepContext>("/rep/context", {
    method: "GET",
    requireCsrf: false,
  });
}

export type DoctorLite = {
  id: number;
  name: string;
  specialty?: string | null;
};
export async function repDoctors(
  routeId: number,
  q: string
): Promise<DoctorLite[]> {
  const qs = new URLSearchParams({ routeId: String(routeId), q });
  return apiFetch<DoctorLite[]>(`/rep/doctors?${qs.toString()}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export type ChemistLite = { id: number; name: string };
export async function repChemists(
  routeId: number,
  q: string
): Promise<ChemistLite[]> {
  const qs = new URLSearchParams({ routeId: String(routeId), q });
  return apiFetch<ChemistLite[]>(`/rep/chemists?${qs.toString()}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export type ProductLite = { id: number; code: string; name: string };
export async function lookupProducts(q: string): Promise<ProductLite[]> {
  const qs = new URLSearchParams({ q });
  return apiFetch<ProductLite[]>(`/lookup/products?${qs.toString()}`, {
    method: "GET",
    requireCsrf: false,
  });
}
