"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api/client";
import type { ApiError } from "../../../lib/api/types";

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

export default function RepDcrPage() {
  const sp = useSearchParams();
  const routeId = Number(sp.get("routeId") ?? "0") || 0;
  const rraId = Number(sp.get("rraId") ?? "0") || 0;

  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [list, setList] = useState<DcrListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [callDate, setCallDate] = useState(todayStr());
  const [doctorId, setDoctorId] = useState<number>(0);
  const [callType, setCallType] = useState("REGULAR");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // DCR list
        const l = await apiFetch<DcrListItem[]>("/rep/dcr-submissions", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setList(Array.isArray(l) ? l : []);

        // Products (lookup is auth-only)
        const p = await apiFetch<ProductItem[]>("/lookup/products", {
          method: "GET",
          requireCsrf: false,
        });
        if (!alive) return;
        setProducts(Array.isArray(p) ? p : []);

        // Doctors require routeId scope
        if (routeId > 0) {
          const d = await apiFetch<DoctorItem[]>(
            `/rep/doctors?routeId=${routeId}`,
            { method: "GET", requireCsrf: false }
          );
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

  async function submit() {
    setBusy(true);
    setCreatedId(null);
    setErr(null);
    try {
      if (!rraId)
        throw new Error(
          "Missing rraId (repRouteAssignmentId). Open this page from /rep."
        );
      if (!routeId)
        throw new Error("Missing routeId. Open this page from /rep.");
      if (!doctorId) throw new Error("Select a doctor.");

      const body = {
        repRouteAssignmentId: rraId,
        callDate,
        doctorCalls: [
          {
            doctorId,
            callType,
            productIds,
          },
        ],
        missedDoctors: [],
      };

      const created = await apiFetch<DcrCreated>("/rep/dcr-submissions", {
        method: "POST",
        body,
      });
      setCreatedId(created.id);
    } catch (e) {
      setErr(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="MR – DCR Submissions">
      <RequireRole role="MR">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border bg-white p-4">
            <div className="font-medium">Create DCR</div>
            <div className="mt-2 text-xs text-zinc-600">
              Requires MR assignment + doctor mapped to route.
            </div>

            {!rraId || !routeId ? (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                Open this page from{" "}
                <Link className="underline" href="/rep">
                  /rep
                </Link>{" "}
                so routeId and rraId are present.
              </div>
            ) : null}

            <div className="mt-3">
              <label className="text-sm">Call date</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                type="date"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <label className="text-sm">Doctor</label>
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={doctorId}
                onChange={(e) => setDoctorId(Number(e.target.value))}
              >
                <option value={0}>Select…</option>
                {doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name ?? `Doctor ${d.id}`}
                  </option>
                ))}
              </select>
              {routeId > 0 && doctors.length === 0 ? (
                <div className="mt-2 text-xs text-zinc-600">
                  No doctors returned for this route. Seed doctor-route mapping
                  (section 5).
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              <label className="text-sm">Call type</label>
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
                placeholder="REGULAR / FOLLOW_UP / ..."
              />
            </div>

            <div className="mt-3">
              <label className="text-sm">Products (optional)</label>
              <select
                multiple
                className="mt-1 h-28 w-full rounded border px-3 py-2 text-sm"
                value={productIds.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => Number(o.value)
                  );
                  setProductIds(selected);
                }}
              >
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {createdId ? (
              <div className="mt-3 rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
                Created DCR submission ID: <b>{createdId}</b>{" "}
                <Link className="underline" href={`/rep/dcr/${createdId}`}>
                  View details
                </Link>
              </div>
            ) : null}

            {err ? (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <button
              disabled={busy}
              onClick={submit}
              className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit DCR"}
            </button>
          </div>

          <div className="rounded border bg-white p-4">
            <div className="font-medium">Recent DCR submissions</div>
            {list.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-600">
                No submissions yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {list.map((s) => (
                  <div key={s.id} className="rounded border p-3 text-sm">
                    <div>
                      <b>{s.callDate}</b> – {s.routeCode} ({s.territoryName})
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      Calls: {s.doctorCallCount} | Missed: {s.missedCount}
                    </div>
                    <div className="mt-2">
                      <Link className="underline" href={`/rep/dcr/${s.id}`}>
                        View #{s.id}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}
