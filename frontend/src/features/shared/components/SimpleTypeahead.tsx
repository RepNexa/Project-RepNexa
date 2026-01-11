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

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label>
        {label}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ width: "100%", padding: 8 }}
        />
      </label>

      {busy ? <div style={{ opacity: 0.7 }}>Loading…</div> : null}

      {opts.length > 0 ? (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {opts.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onSelect(o)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 10,
                border: "none",
                borderBottom: "1px solid #eee",
                background: "white",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
