"use client";

import Link from "next/link";
import type { ApiError } from "@/src/lib/api/types";

export function ApiErrorBanner({
  err,
  title,
}: {
  err: ApiError;
  title?: string;
}) {
  const authish = err.status === 401 || err.code === "AUTH_REQUIRED";
  const forbidden = err.status === 403;
  return (
    <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm">
      <div className="font-medium">{title ?? "Request failed"}</div>
      <div className="mt-1 text-red-900">
        <span className="font-mono">{err.status}</span>{" "}
        <span className="font-mono">{err.code}</span> <span>{err.message}</span>
      </div>
      {(authish || forbidden) && (
        <div className="mt-2">
          <Link className="underline" href="/login">
            Go to /login
          </Link>
        </div>
      )}
    </div>
  );
}

export function SkeletonBox({ lines = 6 }: { lines?: number }) {
  return (
    <div className="overflow-hidden rounded border">
      <div className="border-b bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
        Loading…
      </div>
      <div className="p-3">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="mb-2 h-4 w-full animate-pulse rounded bg-zinc-200 last:mb-0"
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyCard({
  title,
  body,
}: {
  title: string;
  body?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-white p-4">
      <div className="font-medium">{title}</div>
      {body ? <div className="mt-1 text-sm text-zinc-600">{body}</div> : null}
    </div>
  );
}

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function KpiTable({
  data,
  preferredKeys,
}: {
  data: any;
  preferredKeys?: string[];
}) {
  if (!data) return null;
  const src: Record<string, any> = isPlainObject(data?.kpis)
    ? data.kpis
    : isPlainObject(data)
      ? data
      : {};

  const keysRaw = Object.keys(src);
  if (keysRaw.length === 0) return null;

  const keys =
    preferredKeys && preferredKeys.length
      ? preferredKeys.filter((k) => k in src)
      : keysRaw
          .filter((k) => {
            const v = src[k];
            return (
              typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean" ||
              v === null
            );
          })
          .slice(0, 18);

  if (keys.length === 0) return null;

  return (
    <div className="overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left">
          <tr>
            <th className="p-2">Metric</th>
            <th className="p-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-t">
              <td className="p-2 font-mono text-xs text-zinc-700">{k}</td>
              <td className="p-2">
                {src[k] === null ? (
                  <span className="text-zinc-500">null</span>
                ) : (
                  String(src[k])
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ArrayTable({
  title,
  rows,
  maxRows = 20,
}: {
  title: string;
  rows: any[];
  maxRows?: number;
}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const sample = rows.slice(0, maxRows);
  const cols = new Set<string>();
  for (const r of sample) {
    if (isPlainObject(r)) for (const k of Object.keys(r)) cols.add(k);
  }
  const colList = Array.from(cols).slice(0, 8);

  if (colList.length === 0) {
    return (
      <div className="rounded border bg-white p-4">
        <div className="font-medium">{title}</div>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs">
          {JSON.stringify(sample, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="font-medium">{title}</div>
      <div className="mt-2 overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              {colList.map((c) => (
                <th key={c} className="p-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((r, idx) => (
              <tr key={idx} className="border-t">
                {colList.map((c) => (
                  <td key={c} className="p-2">
                    {isPlainObject(r) ? formatCell(r[c]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > sample.length ? (
        <div className="mt-2 text-xs text-zinc-500">
          Showing {sample.length} of {rows.length}.
        </div>
      ) : null}
    </div>
  );
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function RawJson({ data }: { data: any }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm text-zinc-700 underline">
        See raw JSON
      </summary>
      <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs">
        {JSON.stringify(data ?? null, null, 2)}
      </pre>
    </details>
  );
}
