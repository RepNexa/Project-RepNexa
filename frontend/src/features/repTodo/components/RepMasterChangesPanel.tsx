import * as React from "react";
import type { ApiError } from "@/src/lib/api/types";
import type { RepMasterChangeItem } from "../api";

function changeKindTone(kind: string): string {
  switch (kind) {
    case "DELETED":
      return "border-red-200 bg-red-50 text-red-700";
    case "RETIRED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ADDED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
}

function entityTone(entityType: string): string {
  switch (entityType) {
    case "DOCTOR":
      return "bg-violet-50 text-violet-700";
    case "CHEMIST":
      return "bg-indigo-50 text-indigo-700";
    case "PRODUCT":
      return "bg-zinc-100 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function formatChangedAt(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PanelError({ error }: { error: ApiError }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <div className="font-medium">
        Couldn’t load recent master data changes
      </div>
      <div className="mt-1">
        <span className="font-mono">{error.status}</span>{" "}
        <span className="font-mono">{error.code}</span>{" "}
        <span>{error.message}</span>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="h-5 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-100" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
            </div>
            <div className="mt-3 h-3 w-28 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RepMasterChangesPanel({
  items,
  isLoading,
  error,
}: {
  items: RepMasterChangeItem[];
  isLoading: boolean;
  error: ApiError | null;
}) {
  if (isLoading) return <PanelSkeleton />;
  if (error) return <PanelError error={error} />;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Recent master data changes
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Latest doctor, chemist, and product updates relevant to this route.
          </p>
        </div>
        <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
          {items.length} item{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 text-sm text-zinc-600">
          No recent master data changes.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item, idx) => (
            <div
              key={`${item.entityType}-${item.entityId}-${idx}`}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/40 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${entityTone(
                        item.entityType,
                      )}`}
                    >
                      {item.entityType}
                    </span>
                    <div className="truncate text-sm font-semibold text-zinc-900">
                      {item.title}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {item.subtitle || "—"}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${changeKindTone(
                      item.changeKind,
                    )}`}
                  >
                    {item.changeKind}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {formatChangedAt(item.changedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
