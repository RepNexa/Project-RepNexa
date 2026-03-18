"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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

function formatDisplayDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-zinc-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
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
  tone?: "default" | "violet" | "red";
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm sm:p-5">
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

function ActionButton({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex min-h-[44px] items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          : "inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-zinc-900 sm:text-base">
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
          {title}
        </div>
        <div className="mt-1 text-sm leading-6 text-zinc-600">{subtitle}</div>
      </div>

      <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
        {count}
      </div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600 sm:p-8">
      {text}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SoftCard className="p-4 sm:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="mt-4 h-8 w-44 animate-pulse rounded bg-zinc-200 sm:h-9 sm:w-56" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-zinc-100" />
      </SoftCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SoftCard key={i} className="p-4 sm:p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-zinc-200" />
          </SoftCard>
        ))}
      </div>

      <SoftCard className="p-4 sm:p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 sm:p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
              <div className="mt-3 h-4 w-24 animate-pulse rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </SoftCard>
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
      data?.doctorCalls?.reduce(
        (sum, call) => sum + (call.products?.length ?? 0),
        0,
      ) ?? 0;

    return {
      doctorCalls,
      missedDoctors,
      productsPromoted,
    };
  }, [data]);

  return (
    <AppShell title={`MR – DCR Details #${id}`}>
      <RequireRole role="MR">
        <div className="space-y-4 lg:space-y-5">
          <SoftCard className="p-4 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-700 sm:text-xs">
                  Field App
                </div>

                <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  DCR Details
                </div>

                <div className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  Review the full submission, promoted products, and missed doctor
                  notes for this DCR record.
                </div>

                {data ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {data.routeCode}
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                      {data.territoryName}
                    </span>
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                      {formatDisplayDate(data.callDate)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                <ActionButton href="/rep/dcr" primary>
                  Back to DCR
                </ActionButton>
                <ActionButton href="/rep/todo">Open To-do</ActionButton>
              </div>
            </div>
          </SoftCard>

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              {err}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : data ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
              <div className="space-y-4">
                <SoftCard className="p-4 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                        DCR #{data.id}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-zinc-600">
                        Review summary and detailed submission records below.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left sm:text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Submitted
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-900">
                        {formatDateTime(data.submittedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoTile label="Call date" value={data.callDate} />
                    <InfoTile label="Route" value={data.routeCode} />
                    <InfoTile label="Route name" value={data.routeName} />
                    <InfoTile label="Territory" value={data.territoryName} />
                  </div>
                </SoftCard>

                <div className="grid gap-4 sm:grid-cols-3">
                  <SummaryCard
                    label="Doctor calls"
                    value={summary.doctorCalls}
                    note="Recorded in this DCR"
                    tone="violet"
                  />
                  <SummaryCard
                    label="Missed doctors"
                    value={summary.missedDoctors}
                    note="Could not be visited"
                    tone={summary.missedDoctors > 0 ? "red" : "default"}
                  />
                  <SummaryCard
                    label="Products promoted"
                    value={summary.productsPromoted}
                    note="Across all doctor calls"
                    tone="default"
                  />
                </div>

                <SoftCard className="p-4 sm:p-6">
                  <SectionHeader
                    title="Doctor Calls"
                    subtitle="All calls captured in this submission."
                    count={data.doctorCalls.length}
                  />

                  {data.doctorCalls.length === 0 ? (
                    <EmptyBlock text="No doctor calls in this submission." />
                  ) : (
                    <div className="space-y-4 sm:space-y-5">
                      {data.doctorCalls.map((call, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 transition-colors hover:bg-white sm:p-5"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-zinc-900 sm:text-lg">
                                {call.doctorName}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                                  Call Type: {call.callType}
                                </span>
                              </div>
                            </div>

                            <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600">
                              {call.products?.length ?? 0} product
                              {(call.products?.length ?? 0) === 1 ? "" : "s"}
                            </div>
                          </div>

                          {call.products?.length > 0 && (
                            <div className="mt-5">
                              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                Products Promoted
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {call.products.map((p, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 sm:px-4 sm:text-sm"
                                  >
                                    {[p.code, p.name]
                                      .filter(Boolean)
                                      .join(" ")
                                      .trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {call.remark && (
                            <div className="mt-5 border-t border-zinc-100 pt-5">
                              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                Remark / Feedback
                              </div>
                              <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-sm leading-6 text-zinc-700">
                                {call.remark}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SoftCard>

                <SoftCard className="p-4 sm:p-6">
                  <SectionHeader
                    title="Missed Doctors"
                    subtitle="Doctors who could not be visited in this submission."
                    count={data.missedDoctors?.length ?? 0}
                  />

                  {(data.missedDoctors?.length ?? 0) === 0 ? (
                    <EmptyBlock text="No missed doctors recorded in this submission." />
                  ) : (
                    <div className="space-y-4 sm:space-y-5">
                      {data.missedDoctors.map((missed, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-red-100 bg-red-50/60 p-4 sm:p-5"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-zinc-900 sm:text-lg">
                                {missed.doctorName}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                                  Reason: {missed.reason}
                                </span>
                              </div>
                            </div>
                          </div>

                          {missed.remark && (
                            <div className="mt-5 border-t border-red-100 pt-5">
                              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                Optional Note
                              </div>
                              <div className="rounded-2xl border border-zinc-100 bg-white p-4 text-sm leading-6 text-zinc-700">
                                {missed.remark}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SoftCard>
              </div>

              <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                <SoftCard className="p-4 sm:p-6">
                  <div className="text-lg font-semibold tracking-tight text-zinc-900">
                    Submission overview
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600">
                    Quick reference for the selected DCR record.
                  </div>

                  <div className="mt-5 space-y-3">
                    <InfoTile label="Record ID" value={`#${data.id}`} />
                    <InfoTile label="Submitted at" value={formatDateTime(data.submittedAt)} />
                    <InfoTile label="Doctor calls" value={summary.doctorCalls} />
                    <InfoTile label="Missed doctors" value={summary.missedDoctors} />
                    <InfoTile label="Products promoted" value={summary.productsPromoted} />
                  </div>
                </SoftCard>

                <SoftCard className="p-4 sm:p-6">
                  <div className="text-lg font-semibold tracking-tight text-zinc-900">
                    Quick actions
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600">
                    Move back to your main workflow quickly.
                  </div>

                  <div className="mt-5 grid gap-3">
                    <ActionButton href="/rep/dcr" primary>
                      Back to DCR
                    </ActionButton>
                    <ActionButton href="/rep/todo">Open To-do</ActionButton>
                  </div>
                </SoftCard>
              </div>
            </div>
          ) : null}
        </div>
      </RequireRole>
    </AppShell>
  );
}