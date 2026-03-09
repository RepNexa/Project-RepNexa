export function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  if (!Number.isFinite(v)) return "N/A";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    v,
  );
}

export function formatPercent(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  if (!Number.isFinite(v)) return "N/A";
  const pct = v * 100;
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(pct)}%`;
}

export function getAnyNumber(obj: any, paths: Array<string[]>): number | null {
  for (const p of paths) {
    let cur = obj;
    for (const k of p) {
      cur = cur?.[k];
    }
    if (typeof cur === "number" && Number.isFinite(cur)) return cur;
    if (cur === null) return null;
  }
  return null;
}

export function getAnyArray(obj: any, paths: Array<string[]>): any[] | null {
  for (const p of paths) {
    let cur = obj;
    for (const k of p) {
      cur = cur?.[k];
    }
    if (Array.isArray(cur)) return cur;
  }
  return null;
}

export function safeJson(v: any): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v);
  }
}
