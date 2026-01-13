import { apiFetch } from "@/src/lib/api/client";

export type Territory = {
  id: number;
  code: string;
  name: string;
  ownerUserId: number | null;
  ownerUsername: string | null;
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

export async function listTerritories(): Promise<Territory[]> {
  return apiFetch<Territory[]>("/admin/territories", {
    method: "GET",
    requireCsrf: false,
  });
}

export async function createTerritory(input: {
  code: string;
  name: string;
  ownerUsername?: string | null;
}): Promise<Territory> {
  return apiFetch<Territory>("/admin/territories", {
    method: "POST",
    body: input,
  });
}

export async function patchTerritory(
  id: number,
  input: {
    code?: string;
    name?: string;
    ownerUsername?: string | null;
    deleted?: boolean;
  }
): Promise<Territory> {
  return apiFetch<Territory>(`/admin/territories/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function listRoutes(): Promise<Route[]> {
  return apiFetch<Route[]>("/admin/routes", {
    method: "GET",
    requireCsrf: false,
  });
}

export async function createRoute(input: {
  territoryId: number;
  code: string;
  name: string;
}): Promise<Route> {
  return apiFetch<Route>("/admin/routes", { method: "POST", body: input });
}

export async function patchRoute(
  id: number,
  input: {
    territoryId?: number;
    code?: string;
    name?: string;
    deleted?: boolean;
  }
): Promise<Route> {
  return apiFetch<Route>(`/admin/routes/${id}`, {
    method: "PATCH",
    body: input,
  });
}
