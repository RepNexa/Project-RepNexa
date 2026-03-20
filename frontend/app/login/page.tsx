"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ApiError } from "@/src/lib/api/types";
import { login } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

type PortalMode = "mr" | "ho" | "default";

function portalMeta(mode: PortalMode) {
  if (mode === "mr") {
    return {
      badge: "Field App",
      title: "Sign in to Medical Representative Portal",
      description:
        "Access DCR, mileage, chemist reports, and your field to-do workspace.",
      username: "mr@repnexa.local",
      password: "MR@1234",
    };
  }

  if (mode === "ho") {
    return {
      badge: "Management",
      title: "Sign in to Head Office Portal",
      description:
        "Access dashboards, master data, assignments, and operational reports.",
      username: "cm@repnexa.local",
      password: "CM@1234",
    };
  }

  return {
    badge: "Repnexa",
    title: "Sign in to your workspace",
    description:
      "Continue to the workspace that matches your account role and permissions.",
    username: "cm@repnexa.local",
    password: "CM@1234",
  };
}

function QuickFillButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      {label}
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const portal = (searchParams.get("portal") ?? "").toLowerCase();
  const mode: PortalMode =
    portal === "mr" ? "mr" : portal === "ho" ? "ho" : "default";

  const meta = useMemo(() => portalMeta(mode), [mode]);

  const [username, setUsername] = useState(meta.username);
  const [password, setPassword] = useState(meta.password);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUsername(meta.username);
    setPassword(meta.password);
  }, [meta.username, meta.password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const me = await login(username, password);

      if (me.mustChangePassword) {
        router.replace("/change-password");
        return;
      }

      router.replace(routeForRole(me.role));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f1ff_0%,#f8f5ff_42%,#ffffff_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-xl font-bold text-white shadow-[0_12px_30px_rgba(124,58,237,0.28)]">
              R
            </div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              repnexa
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Back to portals
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] xl:gap-8">
          <div className="rounded-[32px] border border-zinc-200 bg-white/75 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
              {meta.badge}
            </div>

            <div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              {meta.title}
            </div>

            <div className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
              {meta.description}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Medical Representative
                </div>
                <div className="mt-2 text-sm leading-6 text-zinc-600">
                  Submit DCR, mileage, chemist reports, and manage field tasks.
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Head Office / Company Manager
                </div>
                <div className="mt-2 text-sm leading-6 text-zinc-600">
                  Manage assignments, master data, dashboards, and reporting.
                </div>
              </div>
            </div>

          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              Login
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              Enter your username and password to continue.
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Username
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
                  autoComplete="username"
                  placeholder="Enter your username"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">
                  Password
                </span>
                <input
                  value={password}
                  type="password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </label>

              <button
                disabled={busy}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="font-semibold">{error.code}</div>
                <div className="mt-1">{error.message}</div>
                {error.requestId ? (
                  <div className="mt-1 text-xs opacity-80">
                    RequestId: {error.requestId}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}