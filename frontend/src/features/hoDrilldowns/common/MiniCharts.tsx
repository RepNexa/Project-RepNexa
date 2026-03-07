"use client";

import * as React from "react";

export function MiniLineChart(props: {
  points: { x: string; y: number }[];
  height?: number;
}) {
  const h = props.height ?? 140;

  const pad = 24;

  // Normalize points so we never produce NaN coordinates.
  const pts = React.useMemo(() => {
    return (props.points ?? [])
      .map((p) => ({ x: String(p.x ?? ""), y: Number(p.y) }))
      .filter((p) => p.x && Number.isFinite(p.y));
  }, [props.points]);

  // Keep width stable-ish but allow some breathing room as points grow.
  // Also ensures there is visible space even when points are sparse.
  const w = React.useMemo(() => {
    const min = 520;
    const step = 80;
    const need = pad * 2 + Math.max(1, pts.length - 1) * step;
    return Math.max(min, need);
  }, [pts.length]);

  const maxY = React.useMemo(() => {
    const ys = pts.map((p) => p.y).filter((y) => Number.isFinite(y));
    return Math.max(1, ...ys);
  }, [pts]);

  const scaled = React.useMemo(() => {
    if (pts.length === 0)
      return [] as { x: number; y: number; label: string; v: number }[];
    const dx = pts.length === 1 ? 0 : (w - 2 * pad) / (pts.length - 1);
    return pts.map((p, i) => {
      const x = pad + i * dx;
      const yy = pad + (h - 2 * pad) * (1 - p.y / maxY);
      return { x, y: yy, label: p.x, v: p.y };
    });
  }, [pts, w, h, pad, maxY]);

  const path = React.useMemo(() => {
    // NOTE: if there is only one point, a "move" command alone doesn't render.
    // We still render a visible dot via <circle/> below.
    if (scaled.length <= 1) return "";
    let d = `M ${scaled[0].x} ${scaled[0].y}`;
    for (let i = 1; i < scaled.length; i++) {
      d += ` L ${scaled[i].x} ${scaled[i].y}`;
    }
    return d;
  }, [scaled]);

  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h} role="img" aria-label="Line chart">
        <rect x="0" y="0" width={w} height={h} fill="white" />
        {/* axis baseline */}
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="#e4e4e7"
        />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#e4e4e7" />
        {/* series */}
        {path ? (
          <path d={path} fill="none" stroke="#6d28d9" strokeWidth="2" />
        ) : null}
        {/* markers (critical for single-point series) */}
        {scaled.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6d28d9" />
        ))}
      </svg>
    </div>
  );
}

export function MiniHBarChart(props: {
  rows: { label: string; value: number }[];
  maxRows?: number;
}) {
  const rows = (props.rows ?? []).slice(0, props.maxRows ?? 6);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = Math.round((r.value / max) * 100);
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs text-zinc-700">
              <span className="truncate">{r.label}</span>
              <span className="ml-2 font-mono">{r.value}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded bg-zinc-100">
              <div
                className="h-2 rounded bg-violet-600"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
