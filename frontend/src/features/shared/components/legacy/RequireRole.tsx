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

function ActionLink({
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
          : "inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-violet-100" />
        <div className="min-w-0 flex-1">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="mt-3 h-7 w-44 animate-pulse rounded bg-zinc-200" />
          <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

function StateCard({
  badge,
  title,
  description,
  tone = "default",
  actions,
}: {
  badge: string;
  title: string;
  description: React.ReactNode;
  tone?: "default" | "danger";
  actions?: React.ReactNode;
}) {
  const badgeClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-violet-200 bg-violet-50 text-violet-700";

  const iconClass =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : "bg-violet-50 text-violet-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${iconClass}`}
          >
            !
          </div>

          <div className="min-w-0">
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium sm:text-xs ${badgeClass}`}
            >
              {badge}
            </div>
            <div className="mt-3 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              {title}
            </div>
            <div className="mt-2 text-sm leading-6 text-zinc-600">
              {description}
            </div>
          </div>
        </div>
      </div>

      {actions ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">{actions}</div>
      ) : null}
    </div>
  );
}

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
    return <LoadingState />;
  }

  if (state === "anon") {
    return (
      <StateCard
        badge="Session required"
        title="Not logged in"
        description="Please log in to continue using this page."
        actions={<ActionLink href="/login" primary>Go to login</ActionLink>}
      />
    );
  }

  if (state === "forbidden") {
    return (
      <StateCard
        badge="Access restricted"
        title="Access denied"
        tone="danger"
        description={
          <>
            This page requires role <b>{role}</b>. You are currently signed in
            as <b>{me?.role ?? "unknown"}</b>.
          </>
        }
        actions={
          <>
            <ActionLink href="/login" primary>
              Switch account
            </ActionLink>
            <ActionLink href="/">Home</ActionLink>
          </>
        }
      />
    );
  }

  return <>{children}</>;
}