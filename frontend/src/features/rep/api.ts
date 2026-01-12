import { apiFetch } from "@/src/lib/api/client";

export type RepContext = {
  repUserId: number;
  routes: Array<{
    repRouteAssignmentId: number;
    routeId: number;
    routeCode: string;
    routeName: string;
    territoryId: number;
    territoryCode: string;
    territoryName: string;
  }>;
};

export async function repContext(): Promise<RepContext> {
  return apiFetch<RepContext>("/rep/context", {
    method: "GET",
    requireCsrf: false,
  });
}
