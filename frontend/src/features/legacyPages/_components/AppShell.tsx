"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, clearCsrfTokenCache } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/types";

type Me = {
  id: number;
  username: string;
  role: "CM" | "FM" | "MR" | string;
  mustChangePassword: boolean;
};

function isApiErrorLike(x: unknown): x is ApiError {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as any).status === "number" &&
    typeof (x as any).code === "string" &&
    typeof (x as any).message === "string"
  );
}

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);

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
        setMeErr(null);
      } catch (e) {
        if (!alive) return;
        setMe(null);
        if (isApiErrorLike(e)) setMeErr(`${e.status} ${e.code}: ${e.message}`);
        else setMeErr("Not logged in");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } finally {
      clearCsrfTokenCache();
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-semibold">
              RepNexa
            </Link>
            <nav className="flex gap-3 text-sm">
              <Link className="hover:underline" href="/login">
                Login
              </Link>
              <Link className="hover:underline" href="/admin">
                Admin (CM)
              </Link>
              <Link className="hover:underline" href="/rep">
                Rep (MR)
              </Link>
              <Link className="hover:underline" href="/ho">
                FM
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {me ? (
              <>
                <span className="rounded bg-zinc-100 px-2 py-1">
                  {me.username} ({me.role})
                </span>
                <button
                  onClick={logout}
                  className="rounded border px-3 py-1 hover:bg-zinc-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-zinc-600">{meErr ?? "…"}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
