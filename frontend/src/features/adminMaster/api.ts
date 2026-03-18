import { apiFetch } from "@/src/lib/api/client";

export type Doctor = {
  id: number;
  name: string;
  specialty: string | null;
  grade: string | null;
  status: "ACTIVE" | "RETIRED" | string;
  deleted: boolean;
  locations: string[];
  primaryRep: string | null;
  secondaryRep: string | null;
};
export type Chemist = {
  id: number;
  routeId: number;
  name: string;
  deleted: boolean;
};
export type Product = {
  id: number;
  code: string;
  name: string;
  deleted: boolean;
};
export type Route = {
  id: number;
  territoryId: number;
  territoryCode: string;
  territoryName: string;
  code: string;
  name: string;
  deleted: boolean;
};

export async function listRoutes(): Promise<Route[]> {
  return apiFetch<Route[]>("/admin/routes", {
    method: "GET",
    requireCsrf: false,
  });
}
export async function listDoctors(q?: string): Promise<Doctor[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Doctor[]>(`/admin/doctors${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}
export async function createDoctor(input: {
  name: string;
  specialty?: string | null;
  grade?: string | null;
  status?: string | null;
}): Promise<Doctor> {
  return apiFetch<Doctor>("/admin/doctors", { method: "POST", body: input });
}
export async function patchDoctor(
  id: number,
  input: {
    name?: string;
    specialty?: string | null;
    grade?: string | null;
    status?: string | null;
    deleted?: boolean;
  },
): Promise<Doctor> {
  return apiFetch<Doctor>(`/admin/doctors/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function listChemists(q?: string): Promise<Chemist[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Chemist[]>(`/admin/chemists${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}
export async function createChemist(input: {
  routeId: number;
  name: string;
}): Promise<Chemist> {
  return apiFetch<Chemist>("/admin/chemists", { method: "POST", body: input });
}
export async function patchChemist(
  id: number,
  input: { routeId?: number; name?: string; deleted?: boolean },
): Promise<Chemist> {
  return apiFetch<Chemist>(`/admin/chemists/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function listProducts(q?: string): Promise<Product[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Product[]>(`/admin/products${qs}`, {
    method: "GET",
    requireCsrf: false,
  });
}
export async function createProduct(input: {
  code: string;
  name: string;
}): Promise<Product> {
  return apiFetch<Product>("/admin/products", { method: "POST", body: input });
}
export async function patchProduct(
  id: number,
  input: { code?: string; name?: string; deleted?: boolean },
): Promise<Product> {
  return apiFetch<Product>(`/admin/products/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function addDoctorRoute(input: {
  doctorId: number;
  routeId: number;
}): Promise<void> {
  await apiFetch<void>("/assignments/doctor-routes", {
    method: "POST",
    body: input,
  });
}

export async function removeDoctorRoute(input: {
  doctorId: number;
  routeId: number;
}): Promise<void> {
  const qs = `?doctorId=${encodeURIComponent(String(input.doctorId))}&routeId=${encodeURIComponent(String(input.routeId))}`;
  await apiFetch<void>(`/assignments/doctor-routes${qs}`, {
    method: "DELETE",
  });
}
