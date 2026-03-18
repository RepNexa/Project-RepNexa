"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ApiError } from "@/src/lib/api/types";
import type { MeResponse } from "@/src/features/auth/api";
import { me } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";
import AppShell from "@/src/features/shared/components/legacy/AppShell";

function fmtErr(e: ApiError | null): string {
  if (!e) return "";
  return `${e.status} ${e.code}: ${e.message}`;
}

function initialsFromUsername(username: string) {
  const base = username.split("@")[0] ?? username;
  const parts = base
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "U";
}

function roleLabel(role: MeResponse["role"]) {
  switch (role) {
    case "CM":
      return "Company Manager";
    case "FM":
      return "Field Manager";
    case "MR":
      return "Medical Representative";
    default:
      return role;
  }
}

function roleTone(role: MeResponse["role"]) {
  switch (role) {
    case "CM":
      return "border-violet-200/80 bg-violet-50 text-violet-700";
    case "FM":
      return "border-sky-200/80 bg-sky-50 text-sky-700";
    case "MR":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-700";
    default:
      return "border-zinc-200/80 bg-zinc-50 text-zinc-700";
  }
}

function SummaryCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "default" | "violet" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200/80 bg-violet-50 text-violet-700"
      : tone === "emerald"
        ? "border-emerald-200/80 bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "border-amber-200/80 bg-amber-50 text-amber-700"
          : "border-zinc-200/80 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-5">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium sm:text-xs ${toneClass}`}
      >
        {label}
      </div>
      <div className="mt-3 break-words text-2xl font-semibold tracking-tight sm:mt-4 sm:text-3xl">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{note}</div>
    </div>
  );
}

function QuickAction({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex min-h-[44px] items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          : "inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-9 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-full max-w-[22rem] animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-5"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-4 w-28 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_340px] xl:gap-6">
        <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
          <div className="h-5 w-36 animate-pulse rounded bg-zinc-200" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-2xl bg-zinc-50/80 p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                <div className="mt-3 h-5 w-40 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-2xl bg-zinc-50/80 p-4">
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                <div className="mt-3 h-4 w-36 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MePage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const d = await me();
        if (!alive) return;
        setData(d);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setData(null);
        setErr(e as ApiError);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const profileHome = useMemo(() => {
    if (!data) return "/";
    return routeForRole(data.role);
  }, [data]);

  return (
    <AppShell title="Profile">
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
                Account
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Profile
              </div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Review your account identity, role access, and password status.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
              <QuickAction href="/change-password" primary>
                Change password
              </QuickAction>
              <QuickAction href={profileHome}>Go to dashboard</QuickAction>
            </div>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {fmtErr(err)}
          </div>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Role"
                value={data.role}
                note={roleLabel(data.role)}
                tone="violet"
              />
              <SummaryCard
                label="User ID"
                value={data.id}
                note="Internal account identifier"
              />
              <SummaryCard
                label="Password status"
                value={data.mustChangePassword ? "Required" : "OK"}
                note={
                  data.mustChangePassword
                    ? "Password change required"
                    : "Password is up to date"
                }
                tone={data.mustChangePassword ? "amber" : "emerald"}
              />
              <SummaryCard
                label="Username"
                value={data.username}
                note="Current login identity"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_340px] xl:gap-6">
              <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700">
                    {initialsFromUsername(data.username)}
                  </div>

                  <div className="min-w-0">
                    <div className="break-words text-2xl font-semibold tracking-tight text-zinc-900">
                      {data.username}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${roleTone(
                          data.role,
                        )}`}
                      >
                        {roleLabel(data.role)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-50/80 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Username
                    </div>
                    <div className="mt-2 break-words text-sm font-medium text-zinc-900">
                      {data.username}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-50/80 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Role
                    </div>
                    <div className="mt-2 text-sm font-medium text-zinc-900">
                      {roleLabel(data.role)} ({data.role})
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-50/80 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Account ID
                    </div>
                    <div className="mt-2 break-all text-sm font-medium text-zinc-900">
                      {data.id}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-zinc-50/80 p-4">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Password requirement
                    </div>
                    <div className="mt-2 text-sm font-medium text-zinc-900">
                      {data.mustChangePassword
                        ? "Password change required"
                        : "No mandatory password change"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
                  <div className="text-lg font-semibold tracking-tight">
                    Quick actions
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600">
                    Manage your account and return to your working area.
                  </div>

                  <div className="mt-5 space-y-3">
                    <Link
                      href="/change-password"
                      className="flex min-h-[52px] items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm transition-colors hover:bg-white"
                    >
                      <span className="font-medium text-zinc-900">
                        Change password
                      </span>
                      <span className="text-zinc-500">→</span>
                    </Link>

                    <Link
                      href={profileHome}
                      className="flex min-h-[52px] items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm transition-colors hover:bg-white"
                    >
                      <span className="font-medium text-zinc-900">
                        Open my dashboard
                      </span>
                      <span className="text-zinc-500">→</span>
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl border border-zinc-100 bg-white/95 p-4 shadow-sm shadow-zinc-200/40 sm:p-6">
                  <div className="text-lg font-semibold tracking-tight">
                    Account notes
                  </div>
                  <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                      Your available pages and actions depend on your assigned role.
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                      Password updates are handled from the Change password page.
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                      This page currently shows core account identity returned by
                      the backend <span className="font-mono">/me</span> endpoint.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}