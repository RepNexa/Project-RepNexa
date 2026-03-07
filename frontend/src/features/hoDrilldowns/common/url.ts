import type { ReadonlyURLSearchParams } from "next/navigation";

export function readIntParam(
  sp: ReadonlyURLSearchParams,
  key: string,
): number | null {
  const raw = sp.get(key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 0 ? i : null;
}

export function readStrParam(
  sp: ReadonlyURLSearchParams,
  key: string,
): string | undefined {
  const raw = sp.get(key);
  return raw && raw.trim().length > 0 ? raw : undefined;
}

export function buildUrlWithParams(
  pathname: string,
  sp: ReadonlyURLSearchParams,
  updates: Record<string, string | number | null | undefined>,
): string {
  const next = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || String(v).length === 0) next.delete(k);
    else next.set(k, String(v));
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
