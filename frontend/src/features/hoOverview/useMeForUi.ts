import { useQuery } from "@tanstack/react-query";
import { me } from "@/src/features/auth/api";

export function useMeForUi() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => me(),
    staleTime: 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
