"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    return fields
      ? `${x.code}: ${x.message} (${fields})`
      : `${x.code}: ${x.message}`;
  }
  return "Request failed";
}

function formatSubmittedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
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

function RecentSubmissionsPanel({
  list,
}: {
  list: DcrListItem[];
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight text-zinc-900">
            Recent submissions
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Review your latest recorded DCR entries.
          </div>
        </div>
        <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
          {list.length}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
          No submissions yet.
        </div>
      ) : (
        <div className="mt-5 max-h-[30rem] space-y-3 overflow-y-auto pr-1">
          {list.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition-colors hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">
                    {s.routeCode} • {s.territoryName}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{s.callDate}</div>
                </div>
                <div className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600">
                  #{s.id}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-zinc-500">Calls</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">
                    {s.doctorCallCount}
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-zinc-500">Missed</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900">
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
                  className="inline-flex w-full items-center justify-center rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 sm:w-auto"
                >
                  View details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RepDcrPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const routeId = Number(sp.get("routeId") ?? "0") || 0;
  const rraId = Number(sp.get("rraId") ?? "0") || 0;

  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [list, setList] = useState<DcrListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  const [callDate, setCallDate] = useState(todayStr());
  const [doctorId, setDoctorId] = useState<number>(0);
  const [callType, setCallType] = useState("HQ");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [remark, setRemark] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [missedRows, setMissedRows] = useState<MissedRow[]>([]);
  const [showMissedSection, setShowMissedSection] = useState(false);
  const [showRecentMobile, setShowRecentMobile] = useState(false);

  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

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
    const totalCalls = list.reduce(
      (sum, item) => sum + (item.doctorCallCount ?? 0),
      0,
    );
    const totalMissed = list.reduce(
      (sum, item) => sum + (item.missedCount ?? 0),
      0,
    );
    const selectedDayRows = list.filter((item) => item.callDate === callDate);
    const selectedDayCalls = selectedDayRows.reduce(
      (sum, item) => sum + (item.doctorCallCount ?? 0),
      0,
    );
    const selectedDayMissed = selectedDayRows.reduce(
      (sum, item) => sum + (item.missedCount ?? 0),
      0,
    );

    return {
      submissions: list.length,
      totalCalls,
      totalMissed,
      productCount: productIds.length,
      selectedDayRows: selectedDayRows.length,
      selectedDayCalls,
      selectedDayMissed,
    };
  }, [list, productIds.length, callDate]);

  const canSubmit = !!rraId && !!routeId && !!doctorId && !busy;

  const addMissedRow = () => {
    setMissedRows((prev) => [
      ...prev,
      { doctorId: 0, reason: "Doctor unavailable", remark: "" },
    ]);
    setShowMissedSection(true);
  };

  const updateMissedRow = (
    index: number,
    field: keyof MissedRow,
    value: any,
  ) => {
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
        throw new Error(
          "Missing route/assignment. Open from a valid rep route context.",
        );
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
      setShowDropdown(false);

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
        <div className="space-y-4 pb-28 lg:space-y-5 sm:pb-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Field App
                </div>

                <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  Daily Call Report
                </div>

                <div className="mt-2 max-w-2xl text-sm text-zinc-600">
                  {/* you can some note hear */}
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
                    {doctors.length} doctors in scope
                  </span>
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {products.length} products loaded
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-col">
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
                <Link
                  href="/rep/chemist"
                  className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                >
                  Chemist report
                </Link>
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[28px] border border-zinc-200 bg-gradient-to-br from-violet-50 via-white to-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold tracking-tight text-zinc-900">
                        Today’s progress
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Snapshot for the currently selected date.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {showMetrics ? 'Hide' : 'View'}
        </button>
        <div className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          Live
        </div>
      </div>

                  </div>
                  {showMetrics && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricTile
                      label="Selected date"
                      value={callDate}
                      note="Current DCR date"
                    />
                    <MetricTile
                      label="Doctor calls"
                      value={stats.selectedDayCalls}
                      note={`${stats.selectedDayRows} submission(s)`}
                    />
                    <MetricTile
                      label="Missed doctors"
                      value={stats.selectedDayMissed}
                      note="For selected date"
                    />
                    <MetricTile
                      label="Products picked"
                      value={stats.productCount}
                      note="Current draft only"
                    />
                  </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-zinc-900">
                      Daily Call Report
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                     {/* we can add anote here  */}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRecentMobile((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 xl:hidden"
                  >
                    {showRecentMobile
                      ? "Hide recent submissions"
                      : `View recent submissions (${list.length})`}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Date</span>
                    <input
                      className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
                      type="date"
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600">Doctor</span>
                    <select
                      className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:bg-white"
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

                <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
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
                            ? "border-violet-500 bg-white text-violet-700 shadow-sm"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
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

                <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        Products promoted
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {/* can add anote */}
                      </div>
                    </div>

                    <div className="inline-flex w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {productIds.length} selected
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDropdown((prev) => !prev)}
                    className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm text-zinc-700 transition hover:bg-white"
                  >
                    <span>
                      {showDropdown ? "Hide product list" : "Choose products"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {showDropdown ? "Close" : "Open"}
                    </span>
                  </button>

                  {showDropdown && (
                    <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
                      {productOptions.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-zinc-50"
                          onClick={() =>
                            setProductIds((prev) =>
                              prev.includes(p.id)
                                ? prev.filter((id) => id !== p.id)
                                : [...prev, p.id],
                            )
                          }
                        >
                          <div
                            className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                              productIds.includes(p.id)
                                ? "border-violet-600 bg-violet-600"
                                : "border-violet-300 bg-white"
                            }`}
                          >
                            {productIds.includes(p.id) && (
                              <div className="h-2.5 w-2.5 rounded-full bg-white" />
                            )}
                          </div>
                          <span className="break-words">{p.label}</span>
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

                <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-medium text-zinc-900">
                    Remark / feedback
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                   {/* can add anote */}
                  </div>
                  <textarea
                    className="mt-4 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:bg-white"
                    placeholder="Key feedback, objections, commitments..."
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div className="mt-5 rounded-[24px] border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">
                        Missed doctors
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {/* add notes. */}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={addMissedRow}
                      className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
                    >
                      + Add missed doctor
                    </button>
                  </div>

                  {showMissedSection && missedRows.length > 0 ? (
                    <div className="mt-5 space-y-4">
                      {missedRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-zinc-600">Doctor</span>
                              <select
                                className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
                                value={row.doctorId}
                                onChange={(e) =>
                                  updateMissedRow(
                                    idx,
                                    "doctorId",
                                    Number(e.target.value),
                                  )
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
                                className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
                                value={row.reason}
                                onChange={(e) =>
                                  updateMissedRow(idx, "reason", e.target.value)
                                }
                              >
                                <option value="Doctor unavailable">
                                  Doctor unavailable
                                </option>
                                <option value="Rep did not go">
                                  Rep did not go
                                </option>
                                <option value="Clinic closed">
                                  Clinic closed
                                </option>
                                <option value="Other">Other</option>
                              </select>
                            </label>
                          </div>

                          <div className="mt-4">
                            <label className="flex flex-col gap-1 text-sm">
                              <span className="text-zinc-600">Optional note</span>
                              <textarea
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 placeholder-zinc-500 outline-none transition focus:border-violet-500"
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
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                      No missed doctors added.
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-zinc-600">
                      {/* we can add notes */}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setShowRecentMobile((prev) => !prev)}
                        className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 xl:hidden"
                      >
                        {showRecentMobile
                          ? "Hide recent"
                          : `View recent (${list.length})`}
                      </button>

                      <button
                        disabled={!canSubmit}
                        onClick={submit}
                        className="hidden items-center justify-center rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                      >
                        {busy ? "Submitting…" : "Submit DCR"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {showRecentMobile && (
                <div className="xl:hidden">
                  <RecentSubmissionsPanel list={list} />
                </div>
              )}
            </div>

            <div className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
              <RecentSubmissionsPanel list={list} />
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
            <div className="mx-auto max-w-md">
              <button
                disabled={!canSubmit}
                onClick={submit}
                className="inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3 text-sm font-medium uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit DCR"}
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}