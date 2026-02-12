"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/src/lib/api/client";
import type { ApiError, ApiFieldError } from "@/src/lib/api/types";

type ChemistItem = { id: number; name: string };
type ProductItem = { id: number; code?: string; name?: string };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtErr(e: unknown): string {
  const x = e as ApiError;
  if (x && typeof x.status === "number" && typeof x.code === "string") {
    const fields = (x.fieldErrors ?? [])
      .map((f) => `${f.field}: ${f.message}`)
      .join("; ");
    return fields
      ? `${x.code}: ${x.message} (${fields})`
      : `${x.code}: ${x.message}`;
  }
  return "Request failed";
}

export default function ChemistPage() {
  const sp = useSearchParams();
  const routeId = Number(sp.get("routeId") ?? "0") || 0;
  const rraId = Number(sp.get("rraId") ?? "0") || 0;

  const [visitDate, setVisitDate] = useState(todayStr());
  const [chemists, setChemists] = useState<ChemistItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [chemistId, setChemistId] = useState<number>(0);
  const [flags, setFlags] = useState<
    Array<{ productId: number; status: "OOS" | "LOW" }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await apiFetch<ProductItem[]>("/lookup/products", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setProducts(Array.isArray(p) ? p : []);

        if (routeId > 0) {
          const c = await apiFetch<ChemistItem[]>(
            `/rep/chemists?routeId=${routeId}`,
            { method: "GET", requireCsrf: false },
          );
          if (!alive) return;
          setChemists(Array.isArray(c) ? c : []);
        } else {
          setChemists([]);
        }

        setErr(null);
      } catch (e) {
        if (!alive) return;
        setErr(fmtErr(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [routeId]);

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      id: Number((p as any).id),
      label:
        `${(p as any).code ?? ""} ${(p as any).name ?? ""}`.trim() ||
        `Product ${p.id}`,
    }));
  }, [products]);

  function addFlag() {
    const firstPid = productOptions[0]?.id ?? 0;
    if (!firstPid) return;
    setFlags((x) => [...x, { productId: firstPid, status: "LOW" }]);
  }

  async function submit() {
    setBusy(true);
    setCreatedId(null);
    setErr(null);
    try {
      if (!rraId) throw new Error("Missing rraId. Open this page from /rep.");
      if (!routeId)
        throw new Error("Missing routeId. Open this page from /rep.");
      if (!chemistId)
        throw new Error(
          "Select a chemist (or do not demo live if none exist).",
        );

      const body = {
        repRouteAssignmentId: rraId,
        visitDate,
        visits: [
          {
            chemistId,
            stockFlags: flags.map((f) => ({
              productId: f.productId,
              status: f.status,
            })),
          },
        ],
      };

      const res = await apiFetch<{ id: number }>("/rep/chemist-submissions", {
        method: "POST",
        body,
      });
      setCreatedId(res.id);
    } catch (e) {
      setErr(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="MR – Chemist Report Submission">
      <RequireRole role="MR">
        <div className="max-w-2xl rounded border bg-white p-4">
          <div className="text-sm text-zinc-700">
            Only demo live if chemists exist for this route and you have
            verified once beforehand.
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm">Visit date</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm">Chemist</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={chemistId}
                onChange={(e) => setChemistId(Number(e.target.value))}
              >
                <option value={0}>Select…</option>
                {chemists.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? `Chemist ${c.id}`}
                  </option>
                ))}
              </select>
              {routeId > 0 && chemists.length === 0 ? (
                <div className="mt-2 text-xs text-zinc-600">
                  No chemists returned for this route. If so, do not demo live.
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Stock flags (optional)</div>
              <button
                onClick={addFlag}
                className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
                type="button"
              >
                Add flag
              </button>
            </div>

            {flags.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">No flags added.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {flags.map((f, idx) => (
                  <div key={idx} className="grid gap-2 md:grid-cols-3">
                    <select
                      className="rounded border px-3 py-2 text-sm"
                      value={f.productId}
                      onChange={(e) => {
                        const pid = Number(e.target.value);
                        setFlags((xs) =>
                          xs.map((x, i) =>
                            i === idx ? { ...x, productId: pid } : x,
                          ),
                        );
                      }}
                    >
                      {productOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className="rounded border px-3 py-2 text-sm"
                      value={f.status}
                      onChange={(e) => {
                        const st = e.target.value as "OOS" | "LOW";
                        setFlags((xs) =>
                          xs.map((x, i) =>
                            i === idx ? { ...x, status: st } : x,
                          ),
                        );
                      }}
                    >
                      <option value="LOW">LOW</option>
                      <option value="OOS">OOS</option>
                    </select>

                    <button
                      className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
                      type="button"
                      onClick={() =>
                        setFlags((xs) => xs.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {createdId ? (
            <div className="mt-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
              Created chemist submission ID: <b>{createdId}</b>
            </div>
          ) : null}

          {err ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          <button
            disabled={busy}
            onClick={submit}
            className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? "Submitting…" : "Submit Chemist Report"}
          </button>
        </div>
      </RequireRole>
    </AppShell>
  );
}
