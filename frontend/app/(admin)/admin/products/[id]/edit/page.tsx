"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { listProducts, patchProduct, type Product } from "@/src/features/adminMaster/api";

type ProductRow = Product & {
  priority?: string | null;
  status?: string | null;
};

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

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
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

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
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

export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  const [product, setProduct] = useState<ProductRow | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const all = (await listProducts("")) as ProductRow[];
        const found = all.find((p) => p.id === productId) ?? null;

        if (!found) {
          setProduct(null);
          setErr({ code: "PRODUCT_NOT_FOUND", message: "Product not found", status: 404 } as any);
          return;
        }

        setProduct(found);
        setCode(found.code ?? "");
        setName(found.name ?? "");
      } catch (e) {
        setErr(e as ApiError);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  async function onSave() {
    if (!code.trim()) {
      setErr({ code: "VALIDATION_ERROR", message: "Code is required" } as any);
      return;
    }
    if (!name.trim()) {
      setErr({ code: "VALIDATION_ERROR", message: "Name is required" } as any);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await patchProduct(productId, { code: code.trim(), name: name.trim() });

      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">Edit Product</div>
            <div className="text-sm text-zinc-500">Update product master data.</div>
          </div>

          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => router.push("/admin/products")} disabled={busy}>
              Back
            </SecondaryButton>
            <PrimaryButton type="button" onClick={onSave} disabled={busy || loading}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>

        {err ? (
          <pre className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {JSON.stringify(err, null, 2)}
          </pre>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-zinc-500">Loading…</div>
        ) : product ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Product code</div>
              <PillInput value={code} onChange={(e) => setCode(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-xs text-zinc-500">Product name</div>
              <PillInput value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="md:col-span-2 text-xs text-zinc-500">
              Prototype fields (molecule, category, priority, launch year) will be editable once backend supports them.
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-500">Product not found.</div>
        )}
      </Card>
    </div>
  );
}