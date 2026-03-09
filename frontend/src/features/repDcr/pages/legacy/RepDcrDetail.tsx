"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/src/lib/api/client";
import type { ApiError } from "@/src/lib/api/types";

type DoctorCall = {
  doctorName: string;
  callType: string;
  products: { code: string; name: string }[];
  remark?: string;
};

type MissedDoctor = {
  doctorName: string;
  reason: string;
  remark?: string;
};

type DcrDetail = {
  id: number;
  callDate: string;
  routeName: string;
  routeCode: string;
  territoryName: string;
  submittedAt: string;
  doctorCalls: DoctorCall[];
  missedDoctors: MissedDoctor[];
};

function fmtErr(e: unknown): string {
  const x = e as ApiError;
  if (x && typeof x.status === "number" && typeof x.code === "string") {
    return `${x.status} ${x.code}: ${x.message}`;
  }
  return "Request failed";
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "violet" | "red";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}
      >
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-9 w-56 animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-zinc-50 p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
              <div className="mt-3 h-4 w-24 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DcrDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<DcrDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const d = await apiFetch<DcrDetail>(`/rep/dcr-submissions/${id}`, {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setData(d);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setData(null);
        setErr(fmtErr(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const summary = useMemo(() => {
    const doctorCalls = data?.doctorCalls?.length ?? 0;
    const missedDoctors = data?.missedDoctors?.length ?? 0;
    const productsPromoted =
      data?.doctorCalls?.reduce((sum, call) => sum + (call.products?.length ?? 0), 0) ?? 0;

    return {
      doctorCalls,
      missedDoctors,
      productsPromoted,
    };
  }, [data]);

  return (
    <AppShell title={`MR – DCR Details #${id}`}>
      <RequireRole role="MR">
        <div className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Field App
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  DCR Details
                </div>
                <div className="mt-2 text-sm text-zinc-600">
                  Review the full submission, promoted products, and missed doctor
                  notes for this DCR record.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/rep/dcr"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Back to DCR
                </Link>
                <Link
                  href="/rep/todo"
                  className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-zinc-50"
                >
                  Open To-do
                </Link>
              </div>
            </div>
          </div>

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : data ? (
            <div className="space-y-6">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-3xl font-semibold tracking-tight">
                      DCR #{data.id}
                    </div>
                    <div className="mt-2 text-sm text-zinc-600">
                      {data.callDate} • {data.routeCode} ({data.territoryName})
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      Route: {data.routeName}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-zinc-50 px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Submitted
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-900">
                      {formatDateTime(data.submittedAt)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  label="Doctor calls"
                  value={summary.doctorCalls}
                  tone="violet"
                />
                <SummaryCard
                  label="Missed doctors"
                  value={summary.missedDoctors}
                  tone={summary.missedDoctors > 0 ? "red" : "default"}
                />
                <SummaryCard
                  label="Products promoted"
                  value={summary.productsPromoted}
                  tone="default"
                />
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">
                      Doctor Calls
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      All calls captured in this submission.
                    </div>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {data.doctorCalls.length}
                  </div>
                </div>

                {data.doctorCalls.length === 0 ? (
                  <div className="rounded-2xl border bg-zinc-50 p-8 text-center text-sm text-zinc-600">
                    No doctor calls in this submission.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {data.doctorCalls.map((call, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border bg-zinc-50 p-5 transition-colors hover:bg-white"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-zinc-900">
                              {call.doctorName}
                            </div>
                            <div className="mt-2">
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                                Call Type: {call.callType}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600">
                            {call.products?.length ?? 0} product
                            {(call.products?.length ?? 0) === 1 ? "" : "s"}
                          </div>
                        </div>

                        {call.products?.length > 0 && (
                          <div className="mt-5">
                            <div className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
                              Products Promoted
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {call.products.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700"
                                >
                                  {p.code} {p.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {call.remark && (
                          <div className="mt-5 border-t pt-5">
                            <div className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                              Remark / Feedback
                            </div>
                            <div className="rounded-2xl border bg-white p-4 text-sm text-zinc-700">
                              {call.remark}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">
                      Missed Doctors
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Doctors who could not be visited in this submission.
                    </div>
                  </div>
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                    {data.missedDoctors?.length ?? 0}
                  </div>
                </div>

                {(data.missedDoctors?.length ?? 0) === 0 ? (
                  <div className="rounded-2xl border bg-zinc-50 p-8 text-center text-sm text-zinc-600">
                    No missed doctors recorded in this submission.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {data.missedDoctors.map((missed, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-red-100 bg-red-50/60 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-zinc-900">
                              {missed.doctorName}
                            </div>
                            <div className="mt-2">
                              <span className="inline-flex rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                                Reason: {missed.reason}
                              </span>
                            </div>
                          </div>
                        </div>

                        {missed.remark && (
                          <div className="mt-5 border-t border-red-100 pt-5">
                            <div className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
                              Optional Note
                            </div>
                            <div className="rounded-2xl border bg-white p-4 text-sm text-zinc-700">
                              {missed.remark}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </RequireRole>
    </AppShell>
  );
}