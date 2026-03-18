import { apiFetch } from "@/src/lib/api/client";

export type RepRouteAssignment = {
  id: number;
  repUserId: number;
  repUsername: string | null;
  routeId: number;
  startDate: string; // ISO date
  endDate: string | null;
  enabled: boolean;
};

export async function listRepRouteAssignments(): Promise<RepRouteAssignment[]> {
  return apiFetch<RepRouteAssignment[]>("/assignments/rep-routes", {
    method: "GET",
  });
}

export async function createRepRouteAssignment(input: {
  repUsername: string;
  routeId: number;
  startDate: string;
  endDate?: string | null;
}): Promise<RepRouteAssignment> {
  return apiFetch<RepRouteAssignment>("/assignments/rep-routes", {
    method: "POST",
    body: input,
  });
}

export async function patchRepRouteAssignment(
  id: number,
  input: { endDate?: string | null; enabled?: boolean }
): Promise<RepRouteAssignment> {
  return apiFetch<RepRouteAssignment>(`/assignments/rep-routes/${id}`, {
    method: "PATCH",
    body: input,
  });
}