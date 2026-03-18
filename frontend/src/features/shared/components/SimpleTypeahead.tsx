"use client";

import { useEffect, useMemo, useState } from "react";

export type TypeaheadOption<T> = { key: string; label: string; value: T };

export function SimpleTypeahead<T>(props: {
  label: string;
  placeholder?: string;
  fetchOptions: (q: string) => Promise<TypeaheadOption<T>[]>;
  onSelect: (opt: TypeaheadOption<T>) => void;
}) {
  const { label, placeholder, fetchOptions, onSelect } = props;

  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<TypeaheadOption<T>[]>([]);
  const [busy, setBusy] = useState(false);

  const canQuery = useMemo(() => q.trim().length >= 1, [q]);
  const showEmpty = canQuery && !busy && opts.length === 0;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!canQuery) {
        setOpts([]);
        return;
      }

      setBusy(true);
      try {
        const res = await fetchOptions(q.trim());
        if (!cancelled) setOpts(res);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, canQuery, fetchOptions]);

  function handleSelect(opt: TypeaheadOption<T>) {
    onSelect(opt);
    setQ(opt.label);
    setOpts([]);
  }

  return (
    <div className="grid gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600">{label}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
          autoComplete="off"
        />
      </label>

      {busy ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
          Loading…
        </div>
      ) : null}

      {opts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="max-h-64 overflow-y-auto">
            {opts.map((o, idx) => (
              <button
                key={o.key}
                type="button"
                onClick={() => handleSelect(o)}
                className={`flex min-h-[44px] w-full items-center px-4 py-3 text-left text-sm text-zinc-800 transition-colors hover:bg-violet-50 ${
                  idx !== opts.length - 1 ? "border-b border-zinc-100" : ""
                }`}
              >
                <span className="break-words">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
          No matches found.
        </div>
      ) : null}
    </div>
  );
}