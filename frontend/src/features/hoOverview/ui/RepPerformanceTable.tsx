"use client";

import { useState } from "react";
import { formatNumber, formatPercent } from "./format";

export function RepPerformanceTable({ rows }: { rows: any[] }) {
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? rows : rows.slice(0, 5);

  return (
    <div>
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[42%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Rep</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-right">Coverage %</th>
              <th className="px-4 py-3 text-right">Target %</th>
            </tr>
          </thead>

          <tbody>
            {shown.map((r, idx) => {
              const rep = String(
                r.repUsername ??
                  r.repName ??
                  r.name ??
                  r.repCode ??
                  `Rep ${idx + 1}`,
              );

              const visits =
                typeof r.visits === "number"
                  ? r.visits
                  : typeof r.visitCount === "number"
                    ? r.visitCount
                    : null;

              const cov =
                typeof r.coveragePercent === "number"
                  ? r.coveragePercent
                  : typeof r.coveragePct === "number"
                    ? r.coveragePct
                    : null;

              const tgt =
                typeof r.targetAchievementPercent === "number"
                  ? r.targetAchievementPercent
                  : typeof r.achievementPercent === "number"
                    ? r.achievementPercent
                    : null;

              return (
                <tr
                  key={`${rep}-${idx}`}
                  className="border-b border-zinc-100 last:border-b-0"
                >
                  <td className="px-4 py-3.5 font-medium text-zinc-900">
                    <span className="block break-words">{rep}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-zinc-800">
                    {formatNumber(visits)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-zinc-800">
                    {formatPercent(cov)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-zinc-800">
                    {formatPercent(tgt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 5 ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          {expanded
            ? "Show less"
            : `See more (${Math.max(rows.length - 5, 0)} more)`}
        </button>
      ) : null}
    </div>
  );
}