"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { me } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await me();
        if (!alive) return;
        if (m.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        router.replace(routeForRole(m.role));
      } catch {
        if (!alive) return;
        router.replace("/login");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded border bg-white p-5 dark:bg-zinc-950">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Routing…</div>
        <div className="mt-3 text-xs text-zinc-500">
          If you’re not redirected, go to{" "}
          <Link className="underline" href="/login">
            /login
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
