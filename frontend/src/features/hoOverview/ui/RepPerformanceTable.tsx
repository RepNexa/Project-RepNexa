"use client";

import { formatNumber, formatPercent } from "./format";

export function RepPerformanceTable({ rows }: { rows: any[] }) {
  const shown = rows.slice(0, 15);

  return (
    <div>
      <div className="overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr>
              <th className="p-2">Rep</th>
              <th className="p-2">Visits</th>
              <th className="p-2">Coverage %</th>
              <th className="p-2">Target %</th>
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
                <tr key={`${rep}-${idx}`} className="border-t">
                  <td className="p-2">{rep}</td>
                  <td className="p-2">{formatNumber(visits)}</td>
                  <td className="p-2">{formatPercent(cov)}</td>
                  <td className="p-2">{formatPercent(tgt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > shown.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-zinc-700 underline">
            See more
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded bg-zinc-50 p-3 text-xs">
            {JSON.stringify(rows, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
