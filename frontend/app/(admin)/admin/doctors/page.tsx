"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/src/lib/api/types";
import {
  createDoctor,
  listDoctors,
  patchDoctor,
  type Doctor,
} from "@/src/features/adminMaster/api";
import { useRegisterCsvPageExport } from "@/src/features/shared/exports/useCsvPageExport";

type DoctorRow = Doctor & {
  grade?: string | null;
  status?: "ACTIVE" | "RETIRED" | string | null;
  locations?: string[] | null;
  primaryRep?: string | null;
  secondaryRep?: string | null;
  lastUpdated?: string | null;
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

export default function DoctorsPage() {
  useRegisterCsvPageExport({
    label: "Admin – Doctors",
    url: "/api/v1/admin/doctors.csv",
    fallbackFilename: "admin-doctors.csv",
  });

  const [rows, setRows] = useState<Doctor[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "RETIRED" | "ALL">("ACTIVE");
  const [location, setLocation] = useState("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState("ALL");
  const [grade, setGrade] = useState("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [addGrade, setAddGrade] = useState("");
  const [addStatus, setAddStatus] = useState<"ACTIVE" | "RETIRED">("ACTIVE");
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setErr(null);
    try {
      setRows(await listDoctors(""));
    } catch (e) {
      setErr(e as ApiError);
    }
  }
  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      await createDoctor({
        name,
        specialty: specialty || null,
        grade: addGrade || null,
        status: addStatus,
      });
      setName("");
      setSpecialty("");
      setAddGrade("");
      setAddStatus("ACTIVE");
      setAddOpen(false);
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus(d: DoctorRow) {
    const cur = ((d.status ?? "ACTIVE") as string).toUpperCase();
    const next = cur === "RETIRED" ? "ACTIVE" : "RETIRED";
    const msg =
      next === "RETIRED"
        ? "Mark this doctor as RETIRED? They will be hidden from operational dashboards."
        : "Mark this doctor as ACTIVE again?";
    if (!confirm(msg)) return;
    setBusy(true);
    setErr(null);
    try {
      await patchDoctor(d.id, { status: next });
      await reload();
    } catch (e) {
      setErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const specialties = Array.from(
    new Set((rows as DoctorRow[]).map((d) => d.specialty).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b)));

  const filtered = (rows as DoctorRow[])
    .filter((d) => !d.deleted)
    .filter((d) => {
      const st = String(d.status ?? "ACTIVE").toUpperCase();
      return status === "ALL" ? true : st === status;
    })
    .filter((d) => (grade === "ALL" ? true : (d.grade ?? "") === grade))
    .filter((d) =>
      specialtyFilter === "ALL"
        ? true
        : (d.specialty ?? "") === specialtyFilter,
    )
    .filter((d) => {
      const qq = q.trim().toLowerCase();
      if (!qq) return true;
      return (
        (d.name ?? "").toLowerCase().includes(qq) ||
        (d.specialty ?? "").toLowerCase().includes(qq)
      );
    });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="grid gap-4 md:grid-cols-[1.6fr_220px_220px_220px_220px_auto] md:items-end">
          <div>
            <div className="mb-1 text-xs text-zinc-500">
              Search doctor master
            </div>
            <PillInput
              placeholder="Name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Status</div>
            <PillSelect
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "ACTIVE" | "RETIRED" | "ALL")
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="RETIRED">Retired</option>
              <option value="ALL">All</option>
            </PillSelect>
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Location</div>
            <PillSelect
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled
            >
              <option value="ALL">select a location</option>
            </PillSelect>
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Speciality</div>
            <PillSelect
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            >
              <option value="ALL">All specialties</option>
              {specialties.map((s) => (
                <option key={s as string} value={s as string}>
                  {s as string}
                </option>
              ))}
            </PillSelect>
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Grade</div>
            <PillSelect
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="ALL">All grades</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </PillSelect>
          </div>
          <div className="flex md:justify-end">
            <PrimaryButton type="button" onClick={() => setAddOpen(true)}>
              + Add doctor
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Add panel */}
      {addOpen ? (
        <Card className="max-w-3xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-semibold">Add doctor</div>
              <div className="text-sm text-zinc-500">
                Maintain doctor master: grade, locations, status &amp; remarks.
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
              <div className="mb-1 text-xs text-zinc-500">Doctor name</div>
              <PillInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Name"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Specialty (MVP)</div>
              <PillInput
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Grade</div>
              <PillSelect
                value={addGrade}
                onChange={(e) => setAddGrade(e.target.value)}
              >
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </PillSelect>
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Status</div>
              <PillSelect
                value={addStatus}
                onChange={(e) => setAddStatus(e.target.value as any)}
              >
                <option value="ACTIVE">Active</option>
                <option value="RETIRED">Retired</option>
              </PillSelect>
            </div>
            <div className="md:col-span-2 text-xs text-zinc-500">
              Locations/rep assignment/notes remain prototype-only for now.
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={busy || !name.trim()}
              onClick={onCreate}
            >
              Save doctor
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {/* Table */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">Master – Doctors</div>
            <div className="text-sm text-zinc-500">
              One row per doctor. Retired doctors will be hidden from
              operational dashboards.
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
                <th className="px-4 py-3 text-left font-medium">Doctor</th>
                <th className="px-4 py-3 text-left font-medium">Grade</th>
                <th className="px-4 py-3 text-left font-medium">Locations</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Primary Rep</th>
                <th className="px-4 py-3 text-left font-medium">
                  Secondary Rep
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.name}</div>
                    {d.specialty ? (
                      <div className="text-xs text-zinc-500">{d.specialty}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {((d as DoctorRow).grade ?? "—") as any}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3">
                    {String(
                      (d as DoctorRow).status ?? "ACTIVE",
                    ).toUpperCase() === "RETIRED" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Retired
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-zinc-600">—</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-violet-700 hover:underline"
                      disabled={busy}
                      onClick={() => onToggleStatus(d as DoctorRow)}
                      title="Toggle ACTIVE/RETIRED"
                    >
                      {String(
                        (d as DoctorRow).status ?? "ACTIVE",
                      ).toUpperCase() === "RETIRED"
                        ? "Activate"
                        : "Retire"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-zinc-500">
                    No doctors
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
