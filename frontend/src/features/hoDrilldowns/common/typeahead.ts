"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/src/lib/api/types";
import type { TypeaheadOption } from "@/src/features/shared/components/SimpleTypeahead";

export function useCachedTypeahead<TItem, TValue>(args: {
  keyPrefix: string[];
  fetcher: (q: string) => Promise<TItem[]>;
  map: (item: TItem) => TypeaheadOption<TValue>;
  staleTimeMs?: number;
}) {
  const qc = useQueryClient();
  const [lastErr, setLastErr] = useState<ApiError | null>(null);
  const staleTimeMs = args.staleTimeMs ?? 120_000;

  const fetchOptions = useCallback(
    async (q: string): Promise<TypeaheadOption<TValue>[]> => {
      try {
        setLastErr(null);
        const data = await qc.fetchQuery({
          queryKey: [...args.keyPrefix, q.trim()],
          queryFn: () => args.fetcher(q.trim()),
          staleTime: staleTimeMs,
        });
        return (data ?? []).map(args.map);
      } catch (e: any) {
        setLastErr(e as ApiError);
        return [];
      }
    },
    [qc, args, staleTimeMs],
  );

  return { fetchOptions, lastErr };
}
