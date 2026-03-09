"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import { useEffect, useMemo, useState } from "react";
import {  useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/src/lib/api/client";
import type { ApiError } from "@/src/lib/api/types";

type DoctorItem = { id: number; name: string };
type ProductItem = { id: number; code?: string; name?: string };

type DcrCreated = { id: number };

type DcrListItem = {
  id: number;
  callDate: string;
  routeName: string;
  routeCode: string;
  territoryName: string;
  submittedAt: string;
  doctorCallCount: number;
  missedCount: number;
};

type MissedRow = {
  doctorId: number;
  reason: string;
  remark: string;
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
    return fields ? `${x.code}: ${x.message} (${fields})` : `${x.code}: ${x.message}`;
  }
  return "Request failed";
}

function formatSubmittedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function RepDcrPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const routeId = Number(sp.get("routeId") ?? "0") || 0;
  const rraId = Number(sp.get("rraId") ?? "0") || 0;
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
          `/rep/dcr?routeId=${encodeURIComponent(
            first.routeId
          )}&rraId=${encodeURIComponent(first.repRouteAssignmentId)}`
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


  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [list, setList] = useState<DcrListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [callDate, setCallDate] = useState(todayStr());
  const [doctorId, setDoctorId] = useState<number>(0);
  const [callType, setCallType] = useState("HQ");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [remark, setRemark] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [missedRows, setMissedRows] = useState<MissedRow[]>([]);
  const [showMissedSection, setShowMissedSection] = useState(false);

  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const l = await apiFetch<DcrListItem[]>("/rep/dcr-submissions", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setList(Array.isArray(l) ? l : []);

        const p = await apiFetch<ProductItem[]>("/lookup/products", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setProducts(Array.isArray(p) ? p : []);

        if (routeId > 0) {
          const d = await apiFetch<DoctorItem[]>(`/rep/doctors?routeId=${routeId}`, {
            method: "GET",
            requireCsrf: false,
          });
          if (!alive) return;
          setDoctors(Array.isArray(d) ? d : []);
        } else {
          setDoctors([]);
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

  const stats = useMemo(() => {
    const totalCalls = list.reduce((sum, item) => sum + (item.doctorCallCount ?? 0), 0);
    const totalMissed = list.reduce((sum, item) => sum + (item.missedCount ?? 0), 0);
    return {
      submissions: list.length,
      totalCalls,
      totalMissed,
      productCount: productIds.length,
    };
  }, [list, productIds.length]);

  const canSubmit = !!rraId && !!routeId && !!doctorId && !busy;

  const addMissedRow = () => {
    setMissedRows((prev) => [
      ...prev,
      { doctorId: 0, reason: "Doctor unavailable", remark: "" },
    ]);
    setShowMissedSection(true);
  };

  const updateMissedRow = (index: number, field: keyof MissedRow, value: any) => {
    const updated = [...missedRows];
    (updated[index] as any)[field] = value;
    setMissedRows(updated);
  };

  const removeMissedRow = (index: number) => {
    const updated = missedRows.filter((_, i) => i !== index);
    setMissedRows(updated);
    if (updated.length === 0) setShowMissedSection(false);
  };

  async function submit() {
    setBusy(true);
    setCreatedId(null);
    setErr(null);

    try {
      if (!rraId || !routeId) {
        throw new Error("Missing route/assignment. Open from a valid rep route context.");
      }
      if (!doctorId) {
        throw new Error("Select a doctor.");
      }

      const body = {
        repRouteAssignmentId: rraId,
        callDate,
        doctorCalls: [
          {
            doctorId,
            callType,
            productIds,
            remark,
          },
        ],
        missedDoctors: missedRows.map((m) => ({
          doctorId: m.doctorId,
          reason: m.reason,
          remark: m.remark || null,
        })),
      };

      const created = await apiFetch<DcrCreated>("/rep/dcr-submissions", {
        method: "POST",
        body,
      });

      setCreatedId(created.id);
      setDoctorId(0);
      setCallType("HQ");
      setProductIds([]);
      setRemark("");
      setMissedRows([]);
      setShowMissedSection(false);

      const refreshed = await apiFetch<DcrListItem[]>("/rep/dcr-submissions", {
        method: "GET",
        requireCsrf: false,
      });
      setList(Array.isArray(refreshed) ? refreshed : []);
    } catch (e) {
      setErr(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="MR – DCR Submissions">
      <RequireRole role="MR">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Field App
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  DCR Submission
                </div>
                <div className="mt-2 max-w-2xl text-sm text-zinc-600">
                  Record doctor calls, promoted products, field feedback, and any
                  missed doctors for the selected date.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
                <Link
                  href="/rep/chemist"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Chemist report
                </Link>
              </div>
            </div>
          </div>

          {(!routeId || !rraId) && !err &&(
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    Resolving your route context…
            </div>
          )}

          {createdId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
              Submission created successfully. ID: <b>{createdId}</b>{" "}
              <Link className="font-medium underline" href={`/rep/dcr/${createdId}`}>
                View details
              </Link>
            </div>
          )}

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                Recent submissions
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">
                {stats.submissions}
              </div>
              <div className="mt-2 text-sm text-zinc-600">Visible in this session list</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                Total calls
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">
                {stats.totalCalls}
              </div>
              <div className="mt-2 text-sm text-zinc-600">Across recent DCR submissions</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Missed doctors
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">
                {stats.totalMissed}
              </div>
              <div className="mt-2 text-sm text-zinc-600">Recent missed entries recorded</div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                Products selected
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight">
                {stats.productCount}
              </div>
              <div className="mt-2 text-sm text-zinc-600">For the current doctor call</div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
            <div className="space-y-6">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <div className="text-xl font-semibold tracking-tight">
                    Create DCR
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Capture one doctor call with optional products, feedback, and
                    missed doctor notes.
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Call date</span>
                    <input
                      className="h-11 rounded-xl border px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                      type="date"
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Doctor</span>
                    <select
                      className="h-11 rounded-xl border px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                      value={doctorId}
                      onChange={(e) => setDoctorId(Number(e.target.value))}
                    >
                      <option value={0}>Select doctor</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name ?? `Doctor ${d.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-6 rounded-2xl border bg-zinc-50 p-5">
                  <div className="mb-3 text-sm font-medium text-zinc-900">
                    Call type
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { value: "HQ", label: "HQ" },
                      { value: "NO", label: "NO" },
                      { value: "Ex HQ", label: "Ex HQ" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                          callType === option.value
                            ? "border-violet-600 bg-violet-50 text-violet-700 shadow-sm"
                            : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        <input
                          type="radio"
                          name="callType"
                          value={option.value}
                          checked={callType === option.value}
                          onChange={(e) => setCallType(e.target.value)}
                          className="hidden"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        Products promoted
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Select one or more products for this call.
                      </div>
                    </div>
                    <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {productIds.length} selected
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="mt-4 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-all hover:bg-zinc-50 focus:border-violet-600 focus:outline-none"
                  >
                    View product list
                  </button>

                  {showDropdown && (
                    <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border bg-white shadow-sm">
                      {productOptions.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-zinc-50"
                          onClick={() =>
                            setProductIds((prev) =>
                              prev.includes(p.id)
                                ? prev.filter((id) => id !== p.id)
                                : [...prev, p.id]
                            )
                          }
                        >
                          <div
                            className={`mr-3 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                              productIds.includes(p.id)
                                ? "border-violet-600 bg-violet-600"
                                : "border-violet-300 bg-white"
                            }`}
                          >
                            {productIds.includes(p.id) && (
                              <div className="h-2.5 w-2.5 rounded-full bg-white" />
                            )}
                          </div>
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {productIds.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {productOptions
                        .filter((p) => productIds.includes(p.id))
                        .map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                          >
                            {p.label}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border bg-white p-5">
                  <div className="text-sm font-medium text-zinc-900">
                    Remark / feedback
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Capture objections, commitments, or any field note from the call.
                  </div>
                  <textarea
                    className="mt-4 w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder-zinc-500 focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
                    placeholder="Key feedback, objections, commitments..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div className="mt-6 rounded-2xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        Missed doctors
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Capture doctors you were scheduled to see but could not.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addMissedRow}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-50"
                    >
                      + Add missed doctor
                    </button>
                  </div>

                  {showMissedSection && missedRows.length > 0 && (
                    <div className="mt-5 space-y-4">
                      {missedRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border bg-zinc-50 p-4"
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-zinc-600">Doctor</span>
                              <select
                                className="h-11 rounded-xl border bg-white px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                                value={row.doctorId}
                                onChange={(e) =>
                                  updateMissedRow(idx, "doctorId", Number(e.target.value))
                                }
                              >
                                <option value={0}>Select doctor</option>
                                {doctors.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-zinc-600">Reason</span>
                              <select
                                className="h-11 rounded-xl border bg-white px-4 text-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
                                value={row.reason}
                                onChange={(e) =>
                                  updateMissedRow(idx, "reason", e.target.value)
                                }
                              >
                                <option value="Doctor unavailable">Doctor unavailable</option>
                                <option value="Rep did not go">Rep did not go</option>
                                <option value="Clinic closed">Clinic closed</option>
                                <option value="Other">Other</option>
                              </select>
                            </label>
                          </div>

                          <div className="mt-4">
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-zinc-600">Optional note</span>
                              <textarea
                                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-700 placeholder-zinc-500 focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
                                placeholder="Any extra explanation..."
                                value={row.remark}
                                onChange={(e) =>
                                  updateMissedRow(idx, "remark", e.target.value)
                                }
                                rows={2}
                                style={{ resize: "vertical" }}
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMissedRow(idx)}
                            className="mt-4 text-sm font-medium text-red-600 hover:underline"
                          >
                            Remove row
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-zinc-600">
                    Make sure doctor, call type, and route context are correct before submitting.
                  </div>
                  <button
                    disabled={!canSubmit}
                    onClick={submit}
                    className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "Submitting…" : "Submit DCR"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:h-[760px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold tracking-tight">
                    Recent DCR submissions
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Review your latest recorded submissions.
                  </div>
                </div>
                <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                  {list.length}
                </div>
              </div>

              {list.length === 0 ? (
                <div className="mt-6 rounded-2xl border bg-zinc-50 p-6 text-center text-sm text-zinc-600">
                  No submissions yet.
                </div>
              ) : (
                <div className="mt-6 h-[660px] space-y-3 overflow-y-auto pr-2">
                  {list.map((s) => (
                    <div
                      key={s.id}
                      className="group rounded-2xl border bg-zinc-50 p-4 transition-all duration-200 hover:border-zinc-300 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-zinc-900">
                            {s.routeCode} • {s.territoryName}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600">
                            {s.callDate}
                          </div>
                        </div>
                        <div className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600">
                          #{s.id}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white p-3">
                          <div className="text-xs text-zinc-500">Calls</div>
                          <div className="mt-1 text-lg font-semibold">
                            {s.doctorCallCount}
                          </div>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <div className="text-xs text-zinc-500">Missed</div>
                          <div className="mt-1 text-lg font-semibold">
                            {s.missedCount}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-zinc-500">
                        Submitted: {formatSubmittedAt(s.submittedAt)}
                      </div>

                      <div className="mt-4">
                        <Link
                          href={`/rep/dcr/${s.id}`}
                          className="inline-flex items-center rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
                        >
                          View details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}