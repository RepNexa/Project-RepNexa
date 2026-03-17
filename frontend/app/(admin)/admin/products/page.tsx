"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createProduct,
  listProducts,
  patchProduct,
  type Product,
} from "@/src/features/adminMaster/api";
import { useRegisterCsvPageExport } from "@/src/features/shared/exports/useCsvPageExport";

type ProductRow = Product & {
  // future fields (prototype) - safe even if backend doesn't send yet
  molecule?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  launchYear?: number | null;
};

function PillInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-10 w-full rounded-full border border-zinc-200 bg-white px-4 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function PillSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-10 w-full appearance-none rounded-full border border-zinc-200 bg-white px-4 pr-9 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  },
) {
  return (
    <button
      {...props}
      className={[
        "h-10 rounded-full bg-violet-600 px-5 text-sm font-medium text-white shadow-sm",
        "hover:bg-violet-700 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  },
) {
  return (
    <button
      {...props}
      className={[
        "h-10 rounded-full border border-zinc-200 bg-white px-5 text-sm",
        "hover:bg-zinc-50 disabled:opacity-50",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

export default function AdminProductsPage() {
  useRegisterCsvPageExport({
    label: "Admin – Products",
    url: "/api/v1/admin/products.csv",
    fallbackFilename: "admin-products.csv",
  });
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [addOpen, setAddOpen] = useState(false);

  // Create form (current API)
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  async function reload() {
    setErr(null);
    try {
      const data = (await listProducts("")) as ProductRow[];
      setRows(data);
    } catch (e) {
      setErr(e as ApiError);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows
      .filter((r) => !r.deleted)
      .filter((r) => {
        if (!qq) return true;
        return (
          (r.name ?? "").toLowerCase().includes(qq) ||
          (r.code ?? "").toLowerCase().includes(qq)
        );
      })
      .filter((r) => {
        if (priority === "ALL") return true;
        return (r.priority ?? "") === priority;
      });
  }, [rows, q, priority]);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      await createProduct({ code, name });
      setCode("");
      setName("");
      setAddOpen(false);
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: number) {
    if (!confirm("Deactivate this item? It will be hidden from dashboards."))
      return;
    setBusy(true);
    setErr(null);
    try {
      await patchProduct(id, { deleted: true });
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="grid gap-4 md:grid-cols-[1.8fr_220px_auto] md:items-end">
          <div>
            <div className="mb-1 text-xs text-zinc-500">
              Search product master
            </div>
            <PillInput
              placeholder="Name, molecule, category\u2026"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Priority</div>
            <PillSelect
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="ALL">All priorities</option>
              <option value="Focus">Focus</option>
              <option value="Support">Support</option>
            </PillSelect>
          </div>
          <div className="flex md:justify-end">
            <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
              + Add product
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Add panel (inline, not modal) */}
      {addOpen ? (
        <Card className="max-w-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-semibold">Add product</div>
              <div className="text-sm text-zinc-500">
                Maintain product master used in all detailing &amp; coverage
                views.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Product code</div>
              <PillInput
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. PRD_ABC_01"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Product name</div>
              <PillInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Brand name"
              />
            </div>

            {/* Prototype fields (not in API yet) */}
            <div className="md:col-span-2 text-xs text-zinc-500">
              Prototype fields like molecule, therapy area, status, launch year,
              notes will be wired once backend exposes them.
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={busy || !code.trim() || !name.trim()}
              onClick={onCreate}
            >
              Save product
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {/* Table */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">Master – Products</div>
            <div className="text-sm text-zinc-500">
              Product list used in DCR, chemist reports and analytics.
            </div>
          </div>
          <div className="text-sm text-zinc-400">Sample data</div>
        </div>

        {err ? (
          <pre className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {JSON.stringify(err, null, 2)}
          </pre>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Launch Year</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.code}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {p.launchYear ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      disabled={busy}
                      onClick={() => onDeactivate(p.id)}
                      title="Deactivate (MVP placeholder for Edit)"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-zinc-500">
                    No products
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
