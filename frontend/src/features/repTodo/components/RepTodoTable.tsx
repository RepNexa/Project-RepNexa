"use client";

import type { RepTodoRow, TargetsResponse } from "../api";

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  // If backend already returns YYYY-MM-DD, keep it.
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
  // Without sprint timelines: treat "at risk" as not started this month
  // (planned > 0 but visits == 0).
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

export function RepTodoTable({
  month,
  rows,
  targets,
}: {
  month: string;
  rows: RepTodoRow[];
  targets: TargetsResponse;
}) {
  return (
    <div className="overflow-hidden rounded border bg-white">
      <div className="flex items-center justify-between border-b bg-zinc-50 px-3 py-2">
        <div className="text-sm font-medium">Month {month}</div>
        <div className="text-xs text-zinc-600">{rows.length} doctors</div>
      </div>

      <div className="grid grid-cols-7 gap-2 border-b bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
        <div>Doctor</div>
        <div>Grade</div>
        <div className="text-right">Planned</div>
        <div className="text-right">Visits</div>
        <div className="text-right">Remaining</div>
        <div>Last visit</div>
        <div>At risk</div>
      </div>

      {rows.map((row, idx) => {
        const planned = safeNum(computePlanned(row, targets));
        const visits = safeNum(computeVisits(row));
        const remaining = safeNum(computeRemaining(row, planned, visits));
        const lastVisit = formatDate(
          (row.lastVisit ?? row.lastVisitDate) as any,
        );
        const atRisk = computeAtRisk(row, planned, visits);

        return (
          <div
            key={`${row.doctorId ?? "x"}-${idx}`}
            className="grid grid-cols-7 items-center gap-2 border-b px-3 py-3 text-sm last:border-b-0"
          >
            <div className="truncate">{doctorLabel(row)}</div>
            <div>{gradeLabel(row)}</div>
            <div className="text-right tabular-nums">{planned}</div>
            <div className="text-right tabular-nums">{visits}</div>
            <div className="text-right tabular-nums">{remaining}</div>
            <div className="tabular-nums">{lastVisit}</div>
            <div>
              {atRisk ? (
                <span className="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
                  At risk
                </span>
              ) : (
                <span className="text-xs text-zinc-500">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
