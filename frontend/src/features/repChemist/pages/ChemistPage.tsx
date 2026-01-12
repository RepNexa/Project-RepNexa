"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiError, ApiFieldError } from "@/src/lib/api/types";
import {
  repChemists,
  repContext,
  lookupProducts,
  type RepContext,
} from "@/src/features/shared/api/repApi";
import {
  createChemistSubmission,
  type StockStatus,
  type CreateChemistSubmissionRequest,
} from "@/src/features/repChemist/api";
import {
  SimpleTypeahead,
  type TypeaheadOption,
} from "@/src/features/shared/components/SimpleTypeahead";

type FlagRow = {
  productId: number | null;
  productLabel: string;
  status: StockStatus | "";
};

type VisitRow = {
  chemistId: number | null;
  chemistLabel: string;
  flags: FlagRow[];
};

type Draft = {
  repRouteAssignmentId: number | null;
  routeId: number | null;
  visitDate: string;
  visits: VisitRow[];
  idempotencyKey: string;
};

const LS_KEY = "rep:chemist:draft:v1";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function newIdemKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mustNumber(x: number | null, field: string): number {
  if (x === null) {
    throw new Error(`${field} is required`);
  }
  return x;
}

function parseErrors(fieldErrors?: ApiFieldError[]) {
  const vChem: Record<number, string[]> = {};
  const vFlag: Record<string, string[]> = {}; // key: "i:j"
  if (!fieldErrors) return { vChem, vFlag };

  for (const fe of fieldErrors) {
    const f = fe.field;
    const m = fe.message;

    const chem = /^visits\[(\d+)\]\.chemistId$/.exec(f);
    if (chem) {
      const i = Number(chem[1]);
      vChem[i] = vChem[i] ?? [];
      vChem[i].push(m);
      continue;
    }

    const flag = /^visits\[(\d+)\]\.stockFlags\[(\d+)\]\./.exec(f);
    if (flag) {
      const i = Number(flag[1]);
      const j = Number(flag[2]);
      const key = `${i}:${j}`;
      vFlag[key] = vFlag[key] ?? [];
      vFlag[key].push(m);
    }
  }

  return { vChem, vFlag };
}

export function ChemistPage() {
  const [ctx, setCtx] = useState<RepContext | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [draft, setDraft] = useState<Draft>(() => ({
    repRouteAssignmentId: null,
    routeId: null,
    visitDate: todayISO(),
    visits: [
      {
        chemistId: null,
        chemistLabel: "",
        flags: [{ productId: null, productLabel: "", status: "" }],
      },
    ],
    idempotencyKey: newIdemKey(),
  }));

  const [inline, setInline] = useState<{
    vChem: Record<number, string[]>;
    vFlag: Record<string, string[]>;
  }>({ vChem: {}, vFlag: {} });

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
            idempotencyKey: parsed.idempotencyKey || newIdemKey(),
          }));
          return;
        }

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

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  const routes = useMemo(() => ctx?.routes ?? [], [ctx]);

  function setRouteByAssignment(repRouteAssignmentId: number) {
    const r = routes.find(
      (x) => x.repRouteAssignmentId === repRouteAssignmentId
    );
    if (!r) return;
    setDraft((p) => ({
      ...p,
      repRouteAssignmentId,
      routeId: r.routeId,
      visits: p.visits.map((v) => ({
        ...v,
        chemistId: null,
        chemistLabel: "",
        flags: v.flags.map((f) => ({
          ...f,
          productId: null,
          productLabel: "",
        })),
      })),
      idempotencyKey: newIdemKey(),
    }));
    setErr(null);
    setCreatedId(null);
    setInline({ vChem: {}, vFlag: {} });
  }

  async function onSubmit() {
    setErr(null);
    setCreatedId(null);
    setInline({ vChem: {}, vFlag: {} });

    if (!draft.repRouteAssignmentId || !draft.routeId) {
      setErr({
        timestamp: new Date().toISOString(),
        status: 400,
        error: "Bad Request",
        code: "VALIDATION_ERROR",
        message: "Route selection is required",
        path: "/rep/chemist",
      });
      return;
    }

    const reqVisits: CreateChemistSubmissionRequest["visits"] =
      draft.visits.map((v, i) => {
        const stockFlags = v.flags
          .filter(
            (f): f is FlagRow & { productId: number } => f.productId !== null
          )
          .map((f) => ({
            productId: f.productId,
            status: (f.status || "OOS").toUpperCase() as StockStatus,
          }));

        return {
          chemistId: mustNumber(v.chemistId, `visits[${i}].chemistId`),
          stockFlags,
        };
      });

    // client min validation
    const local: ApiFieldError[] = [];
    draft.visits.forEach((v, i) => {
      if (v.chemistId === null)
        local.push({
          field: `visits[${i}].chemistId`,
          message: "chemistId is required",
        });
      v.flags.forEach((f, j) => {
        if (f.productId !== null && !f.status)
          local.push({
            field: `visits[${i}].stockFlags[${j}].status`,
            message: "status is required",
          });
      });
    });
    if (local.length) {
      setInline(parseErrors(local));
      return;
    }

    setBusy(true);
    try {
      const res = await createChemistSubmission(
        {
          repRouteAssignmentId: draft.repRouteAssignmentId,
          visitDate: draft.visitDate,
          visits: reqVisits, // server will enforce; draft -> request is safe after local checks
        },
        draft.idempotencyKey
      );

      setCreatedId(res.id);
      localStorage.removeItem(LS_KEY);
      setDraft({
        repRouteAssignmentId: draft.repRouteAssignmentId,
        routeId: draft.routeId,
        visitDate: draft.visitDate,
        visits: [
          {
            chemistId: null,
            chemistLabel: "",
            flags: [{ productId: null, productLabel: "", status: "" }],
          },
        ],
        idempotencyKey: newIdemKey(),
      });
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae);
      if (ae.status === 409 || ae.status === 400) {
        setInline(parseErrors(ae.fieldErrors));
      }
    } finally {
      setBusy(false);
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
      <h1>Chemist Stock Flags</h1>

      {busy ? (
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
            value={draft.visitDate}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                visitDate: e.target.value,
                idempotencyKey: newIdemKey(),
              }))
            }
            style={{ width: "100%", padding: 8, marginTop: 6 }}
          />
        </label>
      </div>

      <h2 style={{ marginTop: 18 }}>Chemist visits</h2>

      {draft.visits.map((v, i) => (
        <div
          key={i}
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
              gridTemplateColumns: "1fr 120px",
              gap: 12,
              alignItems: "end",
            }}
          >
            <SimpleTypeahead
              label={`Chemist #${i + 1}`}
              placeholder="Type chemist name…"
              fetchOptions={async (q) => {
                if (!draft.routeId) return [];
                const res = await repChemists(draft.routeId, q);
                return res.map<TypeaheadOption<{ id: number; label: string }>>(
                  (c) => ({
                    key: String(c.id),
                    label: c.name,
                    value: { id: c.id, label: c.name },
                  })
                );
              }}
              onSelect={(o) =>
                setDraft((p) => {
                  const next = [...p.visits];
                  next[i] = {
                    ...next[i],
                    chemistId: o.value.id,
                    chemistLabel: o.value.label,
                  };
                  return { ...p, visits: next, idempotencyKey: newIdemKey() };
                })
              }
            />

            <button
              type="button"
              disabled={draft.visits.length === 1}
              onClick={() =>
                setDraft((p) => ({
                  ...p,
                  visits: p.visits.filter((_, idx) => idx !== i),
                  idempotencyKey: newIdemKey(),
                }))
              }
              style={{ padding: 10 }}
            >
              Remove visit
            </button>
          </div>

          {inline.vChem[i]?.length ? (
            <div style={{ marginTop: 10, color: "crimson" }}>
              {inline.vChem[i].map((m, idx) => (
                <div key={idx}>• {m}</div>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600 }}>Products</div>

            {v.flags.map((f, j) => {
              const key = `${i}:${j}`;
              return (
                <div
                  key={j}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 160px 120px",
                    gap: 12,
                    alignItems: "end",
                    marginTop: 8,
                  }}
                >
                  <SimpleTypeahead
                    label={`Product #${j + 1}`}
                    placeholder="Type product…"
                    fetchOptions={async (q) => {
                      const res = await lookupProducts(q);
                      return res.map<
                        TypeaheadOption<{ id: number; label: string }>
                      >((p) => ({
                        key: String(p.id),
                        label: `${p.name} (${p.code})`,
                        value: { id: p.id, label: `${p.name} (${p.code})` },
                      }));
                    }}
                    onSelect={(o) =>
                      setDraft((p) => {
                        const next = [...p.visits];
                        const vv = next[i];
                        const flags = [...vv.flags];
                        flags[j] = {
                          ...flags[j],
                          productId: o.value.id,
                          productLabel: o.value.label,
                        };
                        next[i] = { ...vv, flags };
                        return {
                          ...p,
                          visits: next,
                          idempotencyKey: newIdemKey(),
                        };
                      })
                    }
                  />

                  <label>
                    Status
                    <select
                      value={f.status}
                      onChange={(e) =>
                        setDraft((p) => {
                          const next = [...p.visits];
                          const vv = next[i];
                          const flags = [...vv.flags];
                          flags[j] = {
                            ...flags[j],
                            status: e.target.value as StockStatus,
                          };
                          next[i] = { ...vv, flags };
                          return {
                            ...p,
                            visits: next,
                            idempotencyKey: newIdemKey(),
                          };
                        })
                      }
                      style={{ width: "100%", padding: 8, marginTop: 6 }}
                    >
                      <option value="">Select…</option>
                      <option value="OOS">OOS</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => {
                        const next = [...p.visits];
                        const vv = next[i];
                        const flags = vv.flags.filter((_, idx) => idx !== j);
                        next[i] = {
                          ...vv,
                          flags: flags.length
                            ? flags
                            : [
                                {
                                  productId: null,
                                  productLabel: "",
                                  status: "",
                                },
                              ],
                        };
                        return {
                          ...p,
                          visits: next,
                          idempotencyKey: newIdemKey(),
                        };
                      })
                    }
                    style={{ padding: 10 }}
                  >
                    Remove
                  </button>

                  {inline.vFlag[key]?.length ? (
                    <div style={{ gridColumn: "1 / -1", color: "crimson" }}>
                      {inline.vFlag[key].map((m, idx) => (
                        <div key={idx}>• {m}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setDraft((p) => {
                  const next = [...p.visits];
                  const vv = next[i];
                  next[i] = {
                    ...vv,
                    flags: [
                      ...vv.flags,
                      { productId: null, productLabel: "", status: "" },
                    ],
                  };
                  return { ...p, visits: next, idempotencyKey: newIdemKey() };
                })
              }
              style={{ marginTop: 10, padding: 10 }}
            >
              + Add product
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setDraft((p) => ({
            ...p,
            visits: [
              ...p.visits,
              {
                chemistId: null,
                chemistLabel: "",
                flags: [{ productId: null, productLabel: "", status: "" }],
              },
            ],
            idempotencyKey: newIdemKey(),
          }))
        }
        style={{ marginTop: 10, padding: 10 }}
      >
        + Add chemist visit
      </button>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          style={{ padding: "10px 14px" }}
        >
          Submit chemist report
        </button>
      </div>
    </div>
  );
}
