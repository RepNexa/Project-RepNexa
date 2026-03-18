"use client";

import * as React from "react";
import type { RepTodoRow, TargetsResponse } from "../api";

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toISOString().slice(0, 10);
}

function computePlanned(row: RepTodoRow, targets: TargetsResponse): number {
  const planned = row.planned;
  if (typeof planned === "number") return planned;
  const grade = (row.doctorGrade ?? row.grade ?? "") as string;
  const t = targets[grade];
  return typeof t === "number" ? t : 0;
}

function computeVisits(row: RepTodoRow): number {
  if (typeof row.visitsThisMonth === "number") return row.visitsThisMonth;
  if (typeof row.visits === "number") return row.visits;
  return 0;
}

function computeRemaining(row: RepTodoRow, planned: number, visits: number) {
  if (typeof row.remaining === "number") return row.remaining;
  return Math.max(planned - visits, 0);
}

function computeAtRisk(row: RepTodoRow, planned: number, visits: number) {
  if (typeof row.atRisk === "boolean") return row.atRisk;
  return planned > 0 && visits === 0;
}

function doctorLabel(row: RepTodoRow): string {
  const name = row.doctorName;
  if (typeof name === "string" && name.trim()) return name;
  const id = row.doctorId;
  if (typeof id === "number") return `Doctor #${id}`;
  return "—";
}

function gradeLabel(row: RepTodoRow): string {
  const g = (row.doctorGrade ?? row.grade) as unknown;
  return typeof g === "string" && g.trim() ? g : "—";
}

function territoryLabel(row: RepTodoRow): string {
  const t = row.territoryName || row.routeName || row.territory || "";
  return typeof t === "string" && t.trim() ? t : "—";
}

function gradeBadgeClass(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "B":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "C":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

function statusBadgeClass(atRisk: boolean): string {
  return atRisk
    ? "border-red-200 bg-red-100 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function remainingTextClass(remaining: number, atRisk: boolean): string {
  if (atRisk) return "text-red-700";
  if (remaining === 0) return "text-emerald-700";
  if (remaining >= 3) return "text-amber-700";
  return "text-zinc-900";
}

function progressBarClass(atRisk: boolean, remaining: number): string {
  if (atRisk) return "bg-red-400";
  if (remaining === 0) return "bg-emerald-500";
  return "bg-violet-500";
}

function progressWidth(planned: number, visits: number): number {
  if (planned <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((visits / planned) * 100)));
}

function MobileMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "success"
        ? "text-emerald-700"
        : "text-zinc-900";

  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function rowKey(row: RepTodoRow, idx: number) {
  return `${row.doctorId ?? "x"}-${idx}`;
}

export function RepTodoTable({
  month,
  rows,
  targets,
}: {
  month: string;
  rows: RepTodoRow[];
  targets: TargetsResponse;
}) {
  const [expandedMobileRows, setExpandedMobileRows] = React.useState<
    Record<string, boolean>
  >({});

  function toggleMobileRow(key: string) {
    setExpandedMobileRows((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-base font-semibold tracking-tight text-zinc-900">
            Month {month}
          </div>
          <div className="mt-1 text-sm text-zinc-600">
            Doctor-wise visit plan and completion status
          </div>
        </div>
        <div className="inline-flex w-fit rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600">
          {rows.length} doctors
        </div>
      </div>

      <div className="hidden grid-cols-[minmax(0,1.6fr)_80px_minmax(0,1.05fr)_90px_110px_110px_120px_100px] gap-3 border-b border-zinc-100 bg-zinc-50/70 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 md:grid">
        <div>Doctor</div>
        <div>Grade</div>
        <div>Territory</div>
        <div className="text-right">Planned</div>
        <div className="text-right">Visits</div>
        <div className="text-right">Remaining</div>
        <div>Last visit</div>
        <div>Status</div>
      </div>

      <div className="divide-y divide-zinc-100">
        {rows.map((row, idx) => {
          const key = rowKey(row, idx);
          const planned = safeNum(computePlanned(row, targets));
          const visits = safeNum(computeVisits(row));
          const remaining = safeNum(computeRemaining(row, planned, visits));
          const lastVisit = formatDate((row.lastVisit ?? row.lastVisitDate) as any);
          const atRisk = computeAtRisk(row, planned, visits);
          const grade = gradeLabel(row);
          const territory = territoryLabel(row);
          const progress = progressWidth(planned, visits);
          const expanded = !!expandedMobileRows[key];

          return (
            <div
              key={key}
              className={`transition-colors ${
                atRisk ? "bg-red-50/20" : "bg-white"
              } hover:bg-zinc-50/80`}
            >
              <div className="hidden grid-cols-[minmax(0,1.6fr)_80px_minmax(0,1.05fr)_90px_110px_110px_120px_100px] items-center gap-3 px-6 py-4 md:grid">
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">
                    {doctorLabel(row)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    ID: {row.doctorId ?? "—"}
                  </div>
                </div>

                <div>
                  <span
                    className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${gradeBadgeClass(
                      grade,
                    )}`}
                  >
                    {grade}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-700">{territory}</div>
                </div>

                <div className="text-right tabular-nums font-semibold text-zinc-900">
                  {planned}
                </div>

                <div className="text-right">
                  <div className="tabular-nums font-medium text-zinc-900">
                    {visits}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${progressBarClass(
                        atRisk,
                        remaining,
                      )}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div
                  className={`text-right tabular-nums font-semibold ${remainingTextClass(
                    remaining,
                    atRisk,
                  )}`}
                >
                  {remaining}
                </div>

                <div className="text-sm text-zinc-600">{lastVisit}</div>

                <div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                      atRisk,
                    )}`}
                  >
                    {atRisk ? "At risk" : "OK"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 px-4 py-4 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">
                      {doctorLabel(row)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{territory}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${gradeBadgeClass(
                        grade,
                      )}`}
                    >
                      {grade}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                        atRisk,
                      )}`}
                    >
                      {atRisk ? "At risk" : "OK"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${progressBarClass(
                        atRisk,
                        remaining,
                      )}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white px-2 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Planned
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        {planned}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Visits
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        {visits}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Remaining
                      </div>
                      <div
                        className={`mt-1 text-sm font-semibold ${remainingTextClass(
                          remaining,
                          atRisk,
                        )}`}
                      >
                        {remaining}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleMobileRow(key)}
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  {expanded ? "Hide details" : "View details"}
                </button>

                {expanded ? (
                  <div className="grid grid-cols-2 gap-3">
                    <MobileMetric label="Last visit" value={lastVisit} />
                    <MobileMetric
                      label="Status"
                      value={atRisk ? "At risk" : "OK"}
                      tone={atRisk ? "danger" : "success"}
                    />
                    <MobileMetric label="Doctor ID" value={row.doctorId ?? "—"} />
                    <MobileMetric label="Month" value={month} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}