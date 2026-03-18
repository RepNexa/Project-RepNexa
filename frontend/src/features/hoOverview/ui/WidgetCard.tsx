"use client";

export function WidgetCard({
  title,
  loading,
  error,
  empty,
  emptyText,
  className,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5",
        className ?? "",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold tracking-tight text-zinc-950">
          {title}
        </div>
        {loading ? (
          <div className="text-xs font-medium text-zinc-500">Loading…</div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-1/3 rounded-full bg-zinc-100" />
          <div className="h-3 w-full rounded-full bg-zinc-100" />
          <div className="h-3 w-11/12 rounded-full bg-zinc-100" />
          <div className="h-3 w-4/5 rounded-full bg-zinc-100" />
        </div>
      ) : empty ? (
        <div className="text-sm text-zinc-600">{emptyText ?? "No data."}</div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}