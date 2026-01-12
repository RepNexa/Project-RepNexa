import { apiFetch } from "@/src/lib/api/client";

export type RepDoctor = { id: number; name: string; specialty: string | null };
export type RepChemist = { id: number; name: string };
export type LookupProduct = { id: number; code: string; name: string };

export async function repDoctors(
  routeId: number,
  q: string
): Promise<RepDoctor[]> {
  const qs = `?routeId=${encodeURIComponent(
    String(routeId)
  )}&q=${encodeURIComponent(q)}`;
  return apiFetch<RepDoctor[]>(`/rep/doctors${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function repChemists(
  routeId: number,
  q: string
): Promise<RepChemist[]> {
  const qs = `?routeId=${encodeURIComponent(
    String(routeId)
  )}&q=${encodeURIComponent(q)}`;
  return apiFetch<RepChemist[]>(`/rep/chemists${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function lookupProducts(q: string): Promise<LookupProduct[]> {
  const qs = `?q=${encodeURIComponent(q)}`;
  return apiFetch<LookupProduct[]>(`/lookup/products${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}
