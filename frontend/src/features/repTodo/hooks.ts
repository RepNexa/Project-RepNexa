import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ApiError } from "@/src/lib/api/types";
import { getRepContext, getRepTodo, getTargets } from "./api";
import type {
  RepContextResponse,
  RepTodoResponse,
  TargetsResponse,
} from "./api";

export function useRepContext(): UseQueryResult<RepContextResponse, ApiError> {
  return useQuery({
    queryKey: ["repContext"],
    queryFn: () => getRepContext(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTargets(): UseQueryResult<TargetsResponse, ApiError> {
  return useQuery({
    queryKey: ["metaTargets"],
    queryFn: () => getTargets(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useRepTodo(params: {
  month: string;
  routeId: number | null;
}): UseQueryResult<RepTodoResponse, ApiError> {
  return useQuery({
    queryKey: ["repTodo", { month: params.month, routeId: params.routeId }],
    enabled: typeof params.routeId === "number",
    queryFn: () =>
      getRepTodo({
        month: params.month,
        routeId: params.routeId as number,
      }),
    staleTime: 3 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
