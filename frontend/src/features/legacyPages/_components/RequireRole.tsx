"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/src/lib/api/client";

type Me = {
  id: number;
  username: string;
  role: "CM" | "FM" | "MR" | string;
  mustChangePassword: boolean;
};

export default function RequireRole({
  role,
  children,
}: {
  role: "CM" | "FM" | "MR";
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "anon">(
    "loading",
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await apiFetch<Me>("/me", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setMe(m);
        setState(m.role === role ? "ok" : "forbidden");
      } catch {
        if (!alive) return;
        setMe(null);
        setState("anon");
      }
    })();
    return () => {
      alive = false;
    };
  }, [role]);

  if (state === "loading") {
    return <div className="text-zinc-600">Loading session…</div>;
  }

  if (state === "anon") {
    return (
      <div className="rounded border bg-white p-4">
        <div className="font-medium">Not logged in</div>
        <div className="text-sm text-zinc-600">Please log in to continue.</div>
        <div className="mt-3">
          <Link className="underline" href="/login">
            Go to /login
          </Link>
        </div>
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="rounded border bg-white p-4">
        <div className="font-medium">Access denied</div>
        <div className="text-sm text-zinc-600">
          This page requires role <b>{role}</b>. You are{" "}
          <b>{me?.role ?? "unknown"}</b>.
        </div>
        <div className="mt-3 flex gap-3">
          <Link className="underline" href="/login">
            Switch account
          </Link>
          <Link className="underline" href="/">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
