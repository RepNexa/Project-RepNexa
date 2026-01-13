"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role, MeResponse } from "@/src/features/auth/api";
import { me } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

type Props = {
  allowedRoles?: Role[];
  children: React.ReactNode;
};

export function AuthGuard({ allowedRoles, children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meData, setMeData] = useState<MeResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await me();
        if (!mounted) return;
        setMeData(data);

        if (
          data.mustChangePassword &&
          window.location.pathname !== "/change-password"
        ) {
          router.replace("/change-password");
          return;
        }

        if (allowedRoles && !allowedRoles.includes(data.role)) {
          router.replace(routeForRole(data.role));
          return;
        }
      } catch {
        router.replace("/login");
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [allowedRoles, router]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!meData) return null;

  return <>{children}</>;
}
