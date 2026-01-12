"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiError, ApiFieldError } from "@/src/lib/api/types";
import {
  repContext,
  repDoctors,
  lookupProducts,
  type RepContext,
} from "@/src/features/shared/api/repApi";
import {
  SimpleTypeahead,
  type TypeaheadOption,
} from "@/src/features/shared/components/SimpleTypeahead";
import { createDcrSubmission } from "@/src/features/repDcr/api";

type DoctorRow = {
  doctorId: number | null;
  doctorLabel: string;
  callType: string;
  productIds: number[];
  productLabels: string[];
};

type MissedRow = {
  doctorId: number | null;
  doctorLabel: string;
  reason: string;
};

type Draft = {
  repRouteAssignmentId: number | null;
  routeId: number | null;
  callDate: string; // YYYY-MM-DD
  doctorRows: DoctorRow[];
  missedRows: MissedRow[];
  idempotencyKey: string; // stable per draft submission attempt
};

const LS_KEY = "rep:dcr:draft:v1";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function newIdemKey(): string {
  // browser-safe
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseRowErrors(fieldErrors?: ApiFieldError[]): {
  doctorRow: Record<number, string[]>;
  missedRow: Record<number, string[]>;
} {
  const out = {
    doctorRow: {} as Record<number, string[]>,
    missedRow: {} as Record<number, string[]>,
  };
  if (!fieldErrors) return out;

  for (const fe of fieldErrors) {
    const f = fe.field;
    const m = fe.message;

    const dc = /^doctorCalls\[(\d+)\]\./.exec(f);
    if (dc) {
      const idx = Number(dc[1]);
      out.doctorRow[idx] = out.doctorRow[idx] ?? [];
      out.doctorRow[idx].push(m);
      continue;
    }
    const md = /^missedDoctors\[(\d+)\]\./.exec(f);
    if (md) {
      const idx = Number(md[1]);
      out.missedRow[idx] = out.missedRow[idx] ?? [];
      out.missedRow[idx].push(m);
    }
  }
  return out;
}

export function DcrPage() {
  const [ctx, setCtx] = useState<RepContext | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    repRouteAssignmentId: null,
    routeId: null,
    callDate: todayISO(),
    doctorRows: [
      {
        doctorId: null,
        doctorLabel: "",
        callType: "",
        productIds: [],
        productLabels: [],
      },
    ],
    missedRows: [],
    idempotencyKey: newIdemKey(),
  }));

  const [err, setErr] = useState<ApiError | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<{
    doctorRow: Record<number, string[]>;
    missedRow: Record<number, string[]>;
  }>({
    doctorRow: {},
    missedRow: {},
  });

  // Load context + restore draft
  useEffect(() => {
    (async () => {
      try {
        const c = await repContext();
        setCtx(c);

        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Draft;
          setDraft((prev) => ({
            ...prev,
            ...parsed,
            // keep a key if present; if missing, create
            idempotencyKey: parsed.idempotencyKey || newIdemKey(),
          }));
          return;
        }

        // initialize from first route
        if (c.routes.length > 0) {
          setDraft((prev) => ({
            ...prev,
            repRouteAssignmentId: c.routes[0].repRouteAssignmentId,
            routeId: c.routes[0].routeId,
          }));
        }
      } catch (e) {
        setErr(e as ApiError);
      }
    })();
  }, []);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {
      // ignore localStorage errors
    }
  }, [draft]);

  const routes = useMemo(() => ctx?.routes ?? [], [ctx]);

  function setRouteByAssignment(repRouteAssignmentId: number) {
    const r = routes.find(
      (x) => x.repRouteAssignmentId === repRouteAssignmentId
    );
    if (!r) return;
    setDraft((prev) => ({
      ...prev,
      repRouteAssignmentId,
      routeId: r.routeId,
      // Changing route invalidates doctor selections; keep structure but clear ids/labels
      doctorRows: prev.doctorRows.map((row) => ({
        ...row,
        doctorId: null,
        doctorLabel: "",
        productIds: [],
        productLabels: [],
      })),
      missedRows: prev.missedRows.map((m) => ({
        ...m,
        doctorId: null,
        doctorLabel: "",
      })),
      idempotencyKey: newIdemKey(),
    }));
    setRowErrors({ doctorRow: {}, missedRow: {} });
    setErr(null);
  }

  async function onSubmit() {
    setErr(null);
    setCreatedId(null);
    setRowErrors({ doctorRow: {}, missedRow: {} });

    if (!draft.repRouteAssignmentId || !draft.routeId) {
      setErr({
        timestamp: new Date().toISOString(),
        status: 400,
        error: "Bad Request",
        code: "VALIDATION_ERROR",
        message: "Route selection is required",
        path: "/rep/dcr",
      });
      return;
    }

    const doctorCalls = draft.doctorRows
      .map((r) => ({
        doctorId: r.doctorId,
        callType: r.callType.trim(),
        productIds: r.productIds,
      }))
      .filter((x) => x.doctorId !== null) as {
      doctorId: number;
      callType: string;
      productIds: number[];
    }[];

    const missedDoctors = draft.missedRows
      .map((m) => ({ doctorId: m.doctorId, reason: m.reason.trim() || null }))
      .filter((x) => x.doctorId !== null) as {
      doctorId: number;
      reason: string | null;
    }[];

    // client-side minimum validation (server still enforces)
    const localFieldErrors: ApiFieldError[] = [];
    draft.doctorRows.forEach((r, i) => {
      if (r.doctorId !== null && !r.callType.trim()) {
        localFieldErrors.push({
          field: `doctorCalls[${i}].callType`,
          message: "callType is required",
        });
      }
    });
    if (localFieldErrors.length > 0) {
      setRowErrors(parseRowErrors(localFieldErrors));
      return;
    }

    setSubmitBusy(true);
    try {
      const res = await createDcrSubmission(
        {
          repRouteAssignmentId: draft.repRouteAssignmentId,
          callDate: draft.callDate,
          doctorCalls: doctorCalls.map((c) => ({
            doctorId: c.doctorId,
            callType: c.callType,
            productIds: c.productIds,
          })),
          missedDoctors: missedDoctors.map((m) => ({
            doctorId: m.doctorId,
            reason: m.reason,
          })),
        },
        draft.idempotencyKey
      );

      setCreatedId(res.id);
      localStorage.removeItem(LS_KEY);
      setDraft({
        repRouteAssignmentId: draft.repRouteAssignmentId,
        routeId: draft.routeId,
        callDate: draft.callDate,
        doctorRows: [
          {
            doctorId: null,
            doctorLabel: "",
            callType: "",
            productIds: [],
            productLabels: [],
          },
        ],
        missedRows: [],
        idempotencyKey: newIdemKey(),
      });
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae);
      if (ae.status === 409) {
        setRowErrors(parseRowErrors(ae.fieldErrors));
      }
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "24px auto",
        padding: 24,
        position: "relative",
      }}
    >
      <h1>DCR Submission</h1>

      {submitBusy ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.75)",
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "white",
            }}
          >
            Submitting…
          </div>
        </div>
      ) : null}

      {createdId ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #cfe8cf",
            background: "#f5fff5",
            borderRadius: 8,
          }}
        >
          Submitted successfully. Submission ID: <b>{createdId}</b>
        </div>
      ) : null}

      {err ? (
        <pre
          style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}
        >
          {JSON.stringify(err, null, 2)}
        </pre>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px",
          gap: 16,
          marginTop: 16,
        }}
      >
        <label>
          Route
          <select
            value={draft.repRouteAssignmentId ?? ""}
            onChange={(e) => setRouteByAssignment(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          >
            {routes.map((r) => (
              <option
                key={r.repRouteAssignmentId}
                value={r.repRouteAssignmentId}
              >
                {r.territoryName} / {r.routeName} ({r.routeCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          Date
          <input
            type="date"
            value={draft.callDate}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                callDate: e.target.value,
                idempotencyKey: newIdemKey(),
              }))
            }
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>
      </div>

      <h2 style={{ marginTop: 18 }}>Doctor calls</h2>

      {draft.doctorRows.map((row, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 220px 1fr 120px",
              gap: 12,
              alignItems: "end",
            }}
          >
            <SimpleTypeahead
              label={`Doctor #${idx + 1}`}
              placeholder="Type doctor name…"
              fetchOptions={async (q) => {
                if (!draft.routeId) return [];
                const res = await repDoctors(draft.routeId, q);
                return res.map<TypeaheadOption<{ id: number; label: string }>>(
                  (d) => ({
                    key: String(d.id),
                    label: `${d.name}${d.specialty ? ` — ${d.specialty}` : ""}`,
                    value: {
                      id: d.id,
                      label: `${d.name}${
                        d.specialty ? ` — ${d.specialty}` : ""
                      }`,
                    },
                  })
                );
              }}
              onSelect={(o) =>
                setDraft((p) => {
                  const next = [...p.doctorRows];
                  next[idx] = {
                    ...next[idx],
                    doctorId: o.value.id,
                    doctorLabel: o.value.label,
                    productIds: [],
                    productLabels: [],
                  };
                  return {
                    ...p,
                    doctorRows: next,
                    idempotencyKey: newIdemKey(),
                  };
                })
              }
            />

            <label>
              Call type (required)
              <select
                value={row.callType}
                onChange={(e) =>
                  setDraft((p) => {
                    const next = [...p.doctorRows];
                    next[idx] = { ...next[idx], callType: e.target.value };
                    return {
                      ...p,
                      doctorRows: next,
                      idempotencyKey: newIdemKey(),
                    };
                  })
                }
                style={{ width: "100%", padding: 8, marginTop: 6 }}
              >
                <option value="">Select…</option>
                <option value="IN_PERSON">IN_PERSON</option>
                <option value="PHONE">PHONE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>

            <SimpleTypeahead
              label="Add product (optional)"
              placeholder="Type product name/code…"
              fetchOptions={async (q) => {
                const res = await lookupProducts(q);
                return res.map<TypeaheadOption<{ id: number; label: string }>>(
                  (p) => ({
                    key: String(p.id),
                    label: `${p.name} (${p.code})`,
                    value: { id: p.id, label: `${p.name} (${p.code})` },
                  })
                );
              }}
              onSelect={(o) =>
                setDraft((p) => {
                  const next = [...p.doctorRows];
                  const r = next[idx];
                  if (r.productIds.includes(o.value.id)) return p;
                  next[idx] = {
                    ...r,
                    productIds: [...r.productIds, o.value.id],
                    productLabels: [...r.productLabels, o.value.label],
                  };
                  return {
                    ...p,
                    doctorRows: next,
                    idempotencyKey: newIdemKey(),
                  };
                })
              }
            />

            <button
              type="button"
              disabled={draft.doctorRows.length === 1}
              onClick={() =>
                setDraft((p) => {
                  const next = p.doctorRows.filter((_, i) => i !== idx);
                  return {
                    ...p,
                    doctorRows: next,
                    idempotencyKey: newIdemKey(),
                  };
                })
              }
              style={{ padding: 10 }}
            >
              Remove
            </button>
          </div>

          {row.productLabels.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Selected products:
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {row.productLabels.map((lbl, pIdx) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() =>
                      setDraft((p) => {
                        const next = [...p.doctorRows];
                        const r = next[idx];
                        const ids = r.productIds.filter((_, i) => i !== pIdx);
                        const labels = r.productLabels.filter(
                          (_, i) => i !== pIdx
                        );
                        next[idx] = {
                          ...r,
                          productIds: ids,
                          productLabels: labels,
                        };
                        return {
                          ...p,
                          doctorRows: next,
                          idempotencyKey: newIdemKey(),
                        };
                      })
                    }
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: "white",
                    }}
                    title="Click to remove"
                  >
                    {lbl} ×
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {rowErrors.doctorRow[idx]?.length ? (
            <div style={{ marginTop: 10, color: "crimson" }}>
              {rowErrors.doctorRow[idx].map((m, i) => (
                <div key={i}>• {m}</div>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setDraft((p) => ({
            ...p,
            doctorRows: [
              ...p.doctorRows,
              {
                doctorId: null,
                doctorLabel: "",
                callType: "",
                productIds: [],
                productLabels: [],
              },
            ],
            idempotencyKey: newIdemKey(),
          }))
        }
        style={{ marginTop: 10, padding: 10 }}
      >
        + Add doctor row
      </button>

      <h2 style={{ marginTop: 18 }}>Missed doctors</h2>

      {draft.missedRows.map((row, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 12,
            marginTop: 10,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 120px",
              gap: 12,
              alignItems: "end",
            }}
          >
            <SimpleTypeahead
              label={`Missed #${idx + 1}`}
              placeholder="Type doctor name…"
              fetchOptions={async (q) => {
                if (!draft.routeId) return [];
                const res = await repDoctors(draft.routeId, q);
                return res.map<TypeaheadOption<{ id: number; label: string }>>(
                  (d) => ({
                    key: String(d.id),
                    label: `${d.name}${d.specialty ? ` — ${d.specialty}` : ""}`,
                    value: {
                      id: d.id,
                      label: `${d.name}${
                        d.specialty ? ` — ${d.specialty}` : ""
                      }`,
                    },
                  })
                );
              }}
              onSelect={(o) =>
                setDraft((p) => {
                  const next = [...p.missedRows];
                  next[idx] = {
                    ...next[idx],
                    doctorId: o.value.id,
                    doctorLabel: o.value.label,
                  };
                  return {
                    ...p,
                    missedRows: next,
                    idempotencyKey: newIdemKey(),
                  };
                })
              }
            />

            <label>
              Reason (optional)
              <input
                value={row.reason}
                onChange={(e) =>
                  setDraft((p) => {
                    const next = [...p.missedRows];
                    next[idx] = { ...next[idx], reason: e.target.value };
                    return {
                      ...p,
                      missedRows: next,
                      idempotencyKey: newIdemKey(),
                    };
                  })
                }
                style={{ width: "100%", padding: 8, marginTop: 6 }}
              />
            </label>

            <button
              type="button"
              onClick={() =>
                setDraft((p) => ({
                  ...p,
                  missedRows: p.missedRows.filter((_, i) => i !== idx),
                  idempotencyKey: newIdemKey(),
                }))
              }
              style={{ padding: 10 }}
            >
              Remove
            </button>
          </div>

          {rowErrors.missedRow[idx]?.length ? (
            <div style={{ marginTop: 10, color: "crimson" }}>
              {rowErrors.missedRow[idx].map((m, i) => (
                <div key={i}>• {m}</div>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setDraft((p) => ({
            ...p,
            missedRows: [
              ...p.missedRows,
              { doctorId: null, doctorLabel: "", reason: "" },
            ],
            idempotencyKey: newIdemKey(),
          }))
        }
        style={{ marginTop: 10, padding: 10 }}
      >
        + Add missed doctor
      </button>

      <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
        <button
          type="button"
          disabled={submitBusy}
          onClick={onSubmit}
          style={{ padding: "10px 14px" }}
        >
          Submit DCR
        </button>
        <button
          type="button"
          disabled={submitBusy}
          onClick={() => {
            localStorage.removeItem(LS_KEY);
            setDraft({
              repRouteAssignmentId: routes[0]?.repRouteAssignmentId ?? null,
              routeId: routes[0]?.routeId ?? null,
              callDate: todayISO(),
              doctorRows: [
                {
                  doctorId: null,
                  doctorLabel: "",
                  callType: "",
                  productIds: [],
                  productLabels: [],
                },
              ],
              missedRows: [],
              idempotencyKey: newIdemKey(),
            });
            setRowErrors({ doctorRow: {}, missedRow: {} });
            setErr(null);
            setCreatedId(null);
          }}
          style={{ padding: "10px 14px" }}
        >
          Reset draft
        </button>
      </div>
    </div>
  );
}
