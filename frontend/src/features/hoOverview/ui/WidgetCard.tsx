"use client";

export function WidgetCard({
  title,
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-semibold">{title}</div>
        {loading ? <div className="text-xs text-zinc-500">Loading…</div> : null}
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          <div className="h-4 w-2/3 rounded bg-zinc-100" />
          <div className="h-4 w-1/2 rounded bg-zinc-100" />
          <div className="h-4 w-3/4 rounded bg-zinc-100" />
        </div>
      ) : empty ? (
        <div className="text-sm text-zinc-600">{emptyText ?? "No data."}</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
