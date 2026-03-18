"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { listDoctors, patchDoctor, type Doctor } from "@/src/features/adminMaster/api";

type DoctorRow = Doctor & {
  grade?: string | null;
  status?: "ACTIVE" | "RETIRED" | string | null;
  locations?: string[] | null;
  specialty?: string | null;
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

export default function DoctorEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const doctorId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  const [doctor, setDoctor] = useState<DoctorRow | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [status, setStatus] = useState<"ACTIVE" | "RETIRED">("ACTIVE");

  const locationText = useMemo(() => {
    const locs = doctor?.locations ?? [];
    return locs.length ? locs.join(", ") : "—";
  }, [doctor]);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const all = (await listDoctors("")) as DoctorRow[];
        const found = all.find((d) => d.id === doctorId) ?? null;

        if (!found) {
          setDoctor(null);
          setErr({
            code: "DOCTOR_NOT_FOUND",
            message: "Doctor not found",
            status: 404,
          } as any);
          return;
        }

        setDoctor(found);
        setName(found.name ?? "");
        setSpecialty(found.specialty ?? "");
        setGrade(found.grade ?? "");
        setStatus((String(found.status ?? "ACTIVE").toUpperCase() as any) === "RETIRED" ? "RETIRED" : "ACTIVE");
      } catch (e) {
        setErr(e as ApiError);
      } finally {
        setLoading(false);
      }
    })();
  }, [doctorId]);

  async function onSave() {
    if (!name.trim()) {
      setErr({ code: "VALIDATION_ERROR", message: "Name is required" } as any);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      await patchDoctor(doctorId, {
        name: name.trim(),
        specialty: specialty.trim() ? specialty.trim() : null,
        grade: grade ? grade : null,
        status,
      });

      // go back to list
      router.push("/admin/doctors");
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
            <div className="text-base font-semibold">Edit Doctor</div>
            <div className="text-sm text-zinc-500">Update doctor master data.</div>
          </div>

          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => router.push("/admin/doctors")} disabled={busy}>
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
        ) : doctor ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Doctor name</div>
              <PillInput value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-xs text-zinc-500">Specialty</div>
              <PillInput value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 text-xs text-zinc-500">Grade</div>
              <PillSelect value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </PillSelect>
            </div>

            <div>
              <div className="mb-1 text-xs text-zinc-500">Status</div>
              <PillSelect value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="ACTIVE">Active</option>
                <option value="RETIRED">Retired</option>
              </PillSelect>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-xs text-zinc-500">Territory (from Doctor Route Mapping)</div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                {locationText}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Territory is derived from doctor route mapping. Change it via the Doctor Route Mapping page.
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-500">Doctor not found.</div>
        )}
      </Card>
    </div>
  );
}