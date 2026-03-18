"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createRepRouteAssignment,
  listRepRouteAssignments,
  patchRepRouteAssignment,
  type RepRouteAssignment,
} from "@/src/features/assignments/api";

export function AssignmentsPage() {
  const [repUsername, setRepUsername] = useState("mr@repnexa.local");
  const [routeId, setRouteId] = useState("");
  const [startDate, setStartDate] = useState("2026-01-09");
  const [endDate, setEndDate] = useState("");
  const [created, setCreated] = useState<RepRouteAssignment | null>(null);

  const [patchId, setPatchId] = useState("");
  const [patchEndDate, setPatchEndDate] = useState("");
  const [patchDisable, setPatchDisable] = useState(false);

  const [assignments, setAssignments] = useState<RepRouteAssignment[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function reloadAssignments() {
    try {
      setAssignments(await listRepRouteAssignments());
    } catch (e) {
      setError(e as ApiError);
    }
  }

  useEffect(() => {
    void reloadAssignments();
  }, []);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await createRepRouteAssignment({
        repUsername,
        routeId: Number(routeId),
        startDate,
        endDate: endDate ? endDate : null,
      });
      setCreated(res);
      setPatchId(String(res.id));

      await reloadAssignments();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onPatch() {
    setBusy(true);
    setError(null);
    try {
      const res = await patchRepRouteAssignment(Number(patchId), {
        endDate: patchEndDate ? patchEndDate : undefined,
        enabled: patchDisable ? false : undefined,
      });
      setCreated(res);

      await reloadAssignments();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    !busy && repUsername.trim() && routeId.trim() && startDate.trim();
  const canPatch =
    !busy && patchId.trim() && (patchEndDate.trim() || patchDisable);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Assignments</h1>

      {/* Card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <div className="space-y-6">
          {/* Create section */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              Assign rep to route
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Create a new rep → route assignment (with optional end date).
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.7fr_0.8fr_0.8fr_auto] md:items-end">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Rep username
                </div>
                <input
                  value={repUsername}
                  onChange={(e) => setRepUsername(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  placeholder="mr@repnexa.local"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Route ID
                </div>
                <input
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  placeholder="e.g. 12"
                  inputMode="numeric"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Start date
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  End date (optional)
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <button
                disabled={!canCreate}
                onClick={onCreate}
                className={[
                  "h-10 rounded-xl px-5 text-sm font-medium text-white",
                  "bg-green-500 hover:bg-green-700",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "focus:outline-none focus:ring-4 focus:ring-emerald-200",
                ].join(" ")}
              >
                {busy ? "Working…" : "Create"}
              </button>
            </div>
          </section>

          <div className="h-px bg-zinc-100" />

          {/* Patch section */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900">
              End / disable assignment
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Set an end date, or disable an assignment by ID.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.6fr_0.8fr_0.8fr_auto] md:items-end">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  Assignment ID
                </div>
                <input
                  value={patchId}
                  onChange={(e) => setPatchId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  placeholder="e.g. 45"
                  inputMode="numeric"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-zinc-700">
                  End date (optional)
                </div>
                <input
                  type="date"
                  value={patchEndDate}
                  onChange={(e) => setPatchEndDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                />
              </label>

              <label className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={patchDisable}
                  onChange={(e) => setPatchDisable(e.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Disable assignment
              </label>

              <button
                disabled={!canPatch}
                onClick={onPatch}
                className={[
                  "h-10 rounded-xl px-5 text-sm font-medium text-white",
                  "bg-red-600 hover:bg-red-700",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "focus:outline-none focus:ring-4 focus:ring-rose-200",
                ].join(" ")}
              >
                {busy ? "Working…" : "Patch"}
              </button>
            </div>
          </section>

          {error ? (
            <pre className="mt-2 overflow-auto rounded-xl bg-rose-50 p-4 text-xs text-rose-700 ring-1 ring-rose-200">
              {JSON.stringify(error, null, 2)}
            </pre>
          ) : null}

          {created ? (
            <pre className="mt-2 overflow-auto rounded-xl bg-zinc-50 p-4 text-xs text-zinc-700 ring-1 ring-zinc-200">
              {JSON.stringify(created, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>

      {/* Table under the card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">All assignments</div>
            <div className="text-sm text-zinc-500">
              Live data from the database.
            </div>
          </div>
          <div className="text-sm text-zinc-400">{assignments.length} rows</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Assignment ID</th>
                <th className="px-4 py-3 text-left font-medium">Rep User ID</th>
                <th className="px-4 py-3 text-left font-medium">Rep Username</th>
                <th className="px-4 py-3 text-left font-medium">Route ID</th>
                <th className="px-4 py-3 text-left font-medium">Start Date</th>
                <th className="px-4 py-3 text-left font-medium">End Date</th>
                <th className="px-4 py-3 text-left font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{a.id}</td>
                  <td className="px-4 py-3">{a.repUserId}</td>
                  <td className="px-4 py-3">{a.repUsername ?? "—"}</td>
                  <td className="px-4 py-3">{a.routeId}</td>
                  <td className="px-4 py-3">{a.startDate}</td>
                  <td className="px-4 py-3">{a.endDate ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.enabled ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        true
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                        false
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-zinc-500">
                    No assignments found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={reloadAssignments}
          className="mt-4 h-10 rounded-xl border border-zinc-200 bg-white px-5 text-sm hover:bg-zinc-50"
        >
          Refresh table
        </button>
      </div>
    </div>
  );
}