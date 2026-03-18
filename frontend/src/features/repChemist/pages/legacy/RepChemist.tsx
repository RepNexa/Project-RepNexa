"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/src/lib/api/client";
import type { ApiError } from "@/src/lib/api/types";

type ChemistItem = { id: number; name: string };
type ProductItem = { id: number; code?: string; name?: string };

type StockFlag = {
  productId: number;
  status: "OOS" | "LOW";
};

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

function SummaryCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "default" | "violet" | "red" | "amber";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium sm:text-xs ${toneClass}`}
      >
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:mt-4 sm:text-3xl">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{note}</div>
    </div>
  );
}

function statusBadgeClass(status: "OOS" | "LOW") {
  return status === "OOS"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function ActionButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      {children}
    </Link>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{note}</div>
    </div>
  );
}

export default function ChemistPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const routeId = Number(sp.get("routeId") ?? "0") || 0;
  const rraId = Number(sp.get("rraId") ?? "0") || 0;

  const [visitDate, setVisitDate] = useState(todayStr());
  const [chemists, setChemists] = useState<ChemistItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [chemistId, setChemistId] = useState<number>(0);
  const [flags, setFlags] = useState<StockFlag[]>([]);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showHelpMobile, setShowHelpMobile] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (routeId && rraId) return;

      try {
        const ctx = await apiFetch<any>("/rep/context", {
          method: "GET",
          requireCsrf: false,
        });

        if (!alive) return;

        const routes = Array.isArray(ctx?.routes)
          ? ctx.routes
          : Array.isArray(ctx?.assignedRoutes)
            ? ctx.assignedRoutes
            : [];

        if (routes.length > 0) {
          const first = routes[0];
          router.replace(
            `/rep/chemist?routeId=${encodeURIComponent(
              first.routeId,
            )}&rraId=${encodeURIComponent(first.repRouteAssignmentId)}`,
          );
          return;
        }

        setErr("No active route assignments found for this MR.");
      } catch (e) {
        if (!alive) return;
        setErr(fmtErr(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, [routeId, rraId, router]);

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

  const selectedChemist = chemists.find((c) => c.id === chemistId) ?? null;

  const stats = useMemo(() => {
    const oosCount = flags.filter((f) => f.status === "OOS").length;
    const lowCount = flags.filter((f) => f.status === "LOW").length;
    return {
      chemists: chemists.length,
      products: products.length,
      totalFlags: flags.length,
      oosCount,
      lowCount,
    };
  }, [chemists.length, products.length, flags]);

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
      if (!rraId) {
        throw new Error("Missing rraId. Open this page from a valid rep route.");
      }
      if (!routeId) {
        throw new Error(
          "Missing routeId. Open this page from a valid rep route.",
        );
      }
      if (!chemistId) {
        throw new Error("Select a chemist.");
      }

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
      setFlags([]);
    } catch (e) {
      setErr(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !!rraId && !!routeId && !!chemistId && !busy;

  return (
    <AppShell title="MR – Chemist Report Submission">
      <RequireRole role="MR">
        <div className="space-y-4 pb-28 lg:space-y-5 sm:pb-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
                  Field App
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  Chemist Report
                </div>
                <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  {/* Add notes */}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                      routeId && rraId
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {routeId && rraId ? "Route context ready" : "Resolving route"}
                  </span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {chemists.length} chemists in scope
                  </span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {products.length} products loaded
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:flex-col">
                <ActionButton href="/rep/dcr">Open DCR</ActionButton>
                <ActionButton href="/rep/todo">Open To-do</ActionButton>
              </div>
            </div>
          </div>

          {(!routeId || !rraId) && !err && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Resolving your route context…
            </div>
          )}

          {createdId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
              Created chemist submission ID: <b>{createdId}</b>
            </div>
          )}

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[28px] border border-zinc-200 bg-gradient-to-br from-violet-50 via-white to-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold tracking-tight text-zinc-900">
                        Visit snapshot
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Quick status for the current chemist report.
                      </div>
                    </div>
                    <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      Live
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricTile
                      label="Visit date"
                      value={visitDate}
                      note="Current entry date"
                    />
                    <MetricTile
                      label="Chemist"
                      value={selectedChemist?.name ?? "—"}
                      note="Selected visit target"
                    />
                    <MetricTile
                      label="Flags"
                      value={stats.totalFlags}
                      note="Current draft only"
                    />
                    <MetricTile
                      label="OOS / LOW"
                      value={`${stats.oosCount} / ${stats.lowCount}`}
                      note="Availability split"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-zinc-900">
                      Submit chemist report
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Complete the main fields first, then add stock flags only
                      if needed.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHelpMobile((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 xl:hidden"
                  >
                    {showHelpMobile ? "Hide guidance" : "View guidance"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Visit date</span>
                    <input
                      className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Chemist</span>
                    <select
                      className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
                      value={chemistId}
                      onChange={(e) => setChemistId(Number(e.target.value))}
                    >
                      <option value={0}>Select chemist</option>
                      {chemists.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name ?? `Chemist ${c.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {routeId > 0 && chemists.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    No chemists were returned for this route. Check chemist-route
                    data before doing a live demo.
                  </div>
                ) : null}

                {selectedChemist ? (
                  <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Selected chemist
                    </div>
                    <div className="mt-3 rounded-2xl bg-white p-4">
                      <div className="text-xs text-zinc-500">Chemist name</div>
                      <div className="mt-1 font-medium text-zinc-900">
                        {selectedChemist.name}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        Stock flags
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Add optional product-level stock issues for this chemist
                        visit.
                      </div>
                    </div>
                    <button
                      onClick={addFlag}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={productOptions.length === 0}
                    >
                      + Add flag
                    </button>
                  </div>

                  {flags.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                      No stock flags added yet.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {flags.map((f, idx) => {
                        const product = productOptions.find(
                          (p) => p.id === f.productId,
                        );

                        return (
                          <div
                            key={idx}
                            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                          >
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-sm font-medium text-zinc-900">
                                Flag #{idx + 1}
                              </div>
                              <span
                                className={`inline-flex self-start rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                                  f.status,
                                )}`}
                              >
                                {f.status === "OOS"
                                  ? "Out of stock"
                                  : "Low stock"}
                              </span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="flex flex-col gap-1 text-sm">
                                <span className="text-zinc-600">Product</span>
                                <select
                                  className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
                                  value={f.productId}
                                  onChange={(e) =>
                                    setFlags((prev) =>
                                      prev.map((row, i) =>
                                        i === idx
                                          ? {
                                              ...row,
                                              productId: Number(e.target.value),
                                            }
                                          : row,
                                      ),
                                    )
                                  }
                                >
                                  {productOptions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="flex flex-col gap-1 text-sm">
                                <span className="text-zinc-600">Status</span>
                                <select
                                  className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
                                  value={f.status}
                                  onChange={(e) =>
                                    setFlags((prev) =>
                                      prev.map((row, i) =>
                                        i === idx
                                          ? {
                                              ...row,
                                              status: e.target.value as
                                                | "OOS"
                                                | "LOW",
                                            }
                                          : row,
                                      ),
                                    )
                                  }
                                >
                                  <option value="LOW">Low stock</option>
                                  <option value="OOS">Out of stock</option>
                                </select>
                              </label>
                            </div>

                            {product ? (
                              <div className="mt-4 rounded-2xl bg-white p-4 text-sm">
                                <div className="text-xs text-zinc-500">
                                  Selected product
                                </div>
                                <div className="mt-1 font-medium text-zinc-900">
                                  {product.label}
                                </div>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                setFlags((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                )
                              }
                              className="mt-4 text-sm font-medium text-red-600 hover:underline"
                            >
                              Remove flag
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm leading-6 text-zinc-600">
                      Submit once the chemist and any stock issues are correct for
                      this route and date.
                    </div>

                    <button
                      onClick={submit}
                      disabled={!canSubmit}
                      className="hidden min-h-[46px] items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                    >
                      {busy ? "Submitting..." : "Submit Chemist Report"}
                    </button>
                  </div>
                </div>
              </div>

              {showHelpMobile && (
                <div className="xl:hidden">
                  <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                    <div className="text-lg font-semibold tracking-tight text-zinc-900">
                      Guidance
                    </div>
                    <div className="mt-2 text-sm leading-6 text-zinc-600">
                      Use stock flags only when there is an actual availability
                      issue at the selected chemist.
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="text-sm font-medium text-zinc-900">
                          Before submitting
                        </div>
                        <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                          <li>• Confirm the visit date and chemist are correct.</li>
                          <li>• Add only the products with real stock issues.</li>
                          <li>• Choose OOS or LOW carefully for each product.</li>
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="text-sm font-medium text-zinc-900">
                          Current visit preview
                        </div>
                        <div className="mt-3 grid gap-3">
                          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                            <span className="text-zinc-500">Date</span>
                            <span className="font-medium text-zinc-900">
                              {visitDate}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                            <span className="text-zinc-500">Chemist</span>
                            <span className="max-w-[60%] truncate text-right font-medium text-zinc-900">
                              {selectedChemist?.name ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                            <span className="text-zinc-500">Flags</span>
                            <span className="font-medium text-zinc-900">
                              {flags.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {flags.length > 0 ? (
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                          <div className="text-sm font-medium text-zinc-900">
                            Added flags
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {flags.map((flag, idx) => {
                              const product = productOptions.find(
                                (p) => p.id === flag.productId,
                              );
                              return (
                                <span
                                  key={`${flag.productId}-${idx}`}
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                                    flag.status,
                                  )}`}
                                >
                                  {(product?.label ?? `Product ${flag.productId}`) +
                                    " • " +
                                    flag.status}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden xl:block">
              <div className="sticky top-24 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="text-lg font-semibold tracking-tight text-zinc-900">
                  Guidance
                </div>
                <div className="mt-2 text-sm leading-6 text-zinc-600">
                  Use stock flags only when there is an actual availability issue
                  at the selected chemist.
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Before submitting
                    </div>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                      <li>• Confirm the visit date and chemist are correct.</li>
                      <li>• Add only the products with real stock issues.</li>
                      <li>• Choose OOS or LOW carefully for each product.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Current visit preview
                    </div>
                    <div className="mt-3 grid gap-3">
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Date</span>
                        <span className="font-medium text-zinc-900">
                          {visitDate}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Chemist</span>
                        <span className="max-w-[60%] truncate text-right font-medium text-zinc-900">
                          {selectedChemist?.name ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                        <span className="text-zinc-500">Flags</span>
                        <span className="font-medium text-zinc-900">
                          {flags.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {flags.length > 0 ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-sm font-medium text-zinc-900">
                        Added flags
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {flags.map((flag, idx) => {
                          const product = productOptions.find(
                            (p) => p.id === flag.productId,
                          );
                          return (
                            <span
                              key={`${flag.productId}-${idx}`}
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                                flag.status,
                              )}`}
                            >
                              {(product?.label ?? `Product ${flag.productId}`) +
                                " • " +
                                flag.status}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <SummaryCard
                      label="Chemists"
                      value={stats.chemists}
                      note="Visible in current route"
                      tone="violet"
                    />
                    <SummaryCard
                      label="Flags added"
                      value={stats.totalFlags}
                      note="In current draft"
                      tone="amber"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
            <div className="mx-auto max-w-md">
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="inline-flex w-full min-h-[46px] items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Submitting..." : "Submit Chemist Report"}
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}