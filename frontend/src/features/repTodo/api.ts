import { apiFetch } from "@/src/lib/api/client";

export type DoctorGrade = "A" | "B" | "C" | string;

export type RouteOption = {
  id: number;
  code?: string;
  name?: string;
} & Record<string, unknown>;

export type RepContextResponse =
  | {
      routes: RouteOption[];
    }
  | {
      assignedRoutes: RouteOption[];
    }
  | Record<string, unknown>;

export type TargetsResponse = Record<string, number>;

export type RepTodoRow = {
  doctorId?: number;
  doctorName?: string;
  doctorGrade?: DoctorGrade;
  grade?: DoctorGrade;
  planned?: number;
  visitsThisMonth?: number;
  visits?: number;
  remaining?: number;
  lastVisit?: string | null;
  lastVisitDate?: string | null;
  atRisk?: boolean;
} & Record<string, unknown>;

export type RepTodoResponse = {
  routeId: number;
  month: string; // YYYY-MM
  rows: RepTodoRow[];
  // Optional: backend may return route options directly
  routes?: RouteOption[];
};

export type RepMasterChangeItem = {
  entityType: "DOCTOR" | "CHEMIST" | "PRODUCT" | string;
  entityId: number;
  title: string;
  changeKind: "ADDED" | "UPDATED" | "RETIRED" | "DELETED" | string;
  changedAt?: string | null;
  subtitle?: string | null;
};

export type RepMasterChangesResponse = {
  routeId: number;
  items: RepMasterChangeItem[];
};

export async function getRepContext(): Promise<RepContextResponse> {
  return apiFetch<RepContextResponse>("/rep/context", {
    method: "GET",
    requireCsrf: false,
  });
}

export async function getTargets(): Promise<TargetsResponse> {
  return apiFetch<TargetsResponse>("/meta/targets", {
    method: "GET",
    requireCsrf: false,
  });
}

export async function getRepTodo(params: {
  month: string;
  routeId: number;
}): Promise<RepTodoResponse> {
  const qs = new URLSearchParams({
    month: params.month,
    routeId: String(params.routeId),
  });
  return apiFetch<RepTodoResponse>(`/rep/todo?${qs.toString()}`, {
    method: "GET",
    requireCsrf: false,
  });
}

export async function getRepMasterChanges(params: {
  routeId: number;
  limit?: number;
}): Promise<RepMasterChangesResponse> {
  const qs = new URLSearchParams({
    routeId: String(params.routeId),
  });
  if (typeof params.limit === "number") {
    qs.set("limit", String(params.limit));
  }

  return apiFetch<RepMasterChangesResponse>(
    `/rep/alerts/master-data?${qs.toString()}`,
    {
      method: "GET",
      requireCsrf: false,
    },
  );
}

export function normalizeRoutes(
  ctx: RepContextResponse,
  todo?: RepTodoResponse | null,
): RouteOption[] {
  if (todo?.routes && Array.isArray(todo.routes)) return todo.routes;

  const anyCtx = ctx as any;
  const raw =
    (Array.isArray(anyCtx?.routes) && anyCtx.routes) ||
    (Array.isArray(anyCtx?.assignedRoutes) && anyCtx.assignedRoutes) ||
    (Array.isArray(anyCtx?.data?.routes) && anyCtx.data.routes) ||
    [];

  return (raw as unknown[])
    .map((r) => {
      const rr = r as any;

      // Backend shape (confirmed): { routeId, routeCode, routeName, ... }
      // Also allow the normalized shape: { id, code, name }
      const id =
        typeof rr?.id === "number"
          ? rr.id
          : typeof rr?.routeId === "number"
            ? rr.routeId
            : null;

      if (id === null) return null;

      const code =
        typeof rr?.code === "string"
          ? rr.code
          : typeof rr?.routeCode === "string"
            ? rr.routeCode
            : undefined;

      const name =
        typeof rr?.name === "string"
          ? rr.name
          : typeof rr?.routeName === "string"
            ? rr.routeName
            : undefined;

      // Ensure final keys are stable for the UI
      return { ...rr, id, code, name } as RouteOption;
    })
    .filter((x): x is RouteOption => x !== null);
}
