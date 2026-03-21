"use client";

import { useEffect, useMemo, useState } from "react";
import { isApiError } from "@/src/lib/api/types";
import {
  addDoctorRoute,
  removeDoctorRoute,
} from "@/src/features/doctorRouteMap/api";
import { listDoctors, type Doctor } from "@/src/features/adminMaster/api";
import { listRoutes, type Route } from "@/src/features/adminGeo/api";

type NoticeTone = "info" | "success" | "error";

type Notice = {
  tone: NoticeTone;
  title: string;
  message: string;
  detail?: string;
};

function NoticeBanner({ notice }: { notice: Notice }) {
  const toneClass =
    notice.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : notice.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-violet-200 bg-violet-50 text-violet-900";

  return (
    <div className={["rounded-xl border p-4 text-sm", toneClass].join(" ")}>
      <div className="font-medium">{notice.title}</div>
      <div className="mt-1 leading-6">{notice.message}</div>
      {notice.detail ? (
        <div className="mt-2 text-xs opacity-80">{notice.detail}</div>
      ) : null}
    </div>
  );
}

function describeApiError(error: unknown, fallback: string): Notice {
  if (!isApiError(error)) {
    return {
      tone: "error",
      title: "Request failed",
      message: fallback,
    };
  }

  switch (error.code) {
    case "DOCTOR_ROUTE_EXISTS":
      return {
        tone: "error",
        title: "Mapping already exists",
        message: "That doctor is already mapped to the selected route.",
      };
    case "DOCTOR_NOT_FOUND":
      return {
        tone: "error",
        title: "Doctor not found",
        message: "The selected doctor could not be found.",
      };
    case "ROUTE_NOT_FOUND":
      return {
        tone: "error",
        title: "Route not found",
        message: "The selected route could not be found.",
      };
    case "VALIDATION_ERROR":
      return {
        tone: "error",
        title: "Check the form",
        message: error.message,
      };
    default:
      return {
        tone: "error",
        title: `Request failed (${error.status})`,
        message: error.message || fallback,
      };
  }
}

function buildRouteLabel(route: Route | undefined) {
  if (!route) return "the selected route";
  return `${route.territoryName} / ${route.name} (${route.code})`;
}

export function DoctorRouteMapPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [routeId, setRouteId] = useState<string>("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setDoctors(await listDoctors(""));
        setRoutes(await listRoutes());
      } catch (e) {
        setNotice(describeApiError(e, "Could not load doctors and routes."));
      }
    })();
  }, []);

  const selectedDoctor = useMemo(
    () => doctors.find((item) => String(item.id) === doctorId),
    [doctors, doctorId]
  );
  const selectedRoute = useMemo(
    () => routes.find((item) => String(item.id) === routeId),
    [routes, routeId]
  );

  async function onAdd() {
    setBusy(true);
    setNotice({
      tone: "info",
      title: "Creating mapping",
      message: "The doctor-to-route mapping is being added.",
    });
    try {
      await addDoctorRoute({
        doctorId: Number(doctorId),
        routeId: Number(routeId),
      });
      setNotice({
        tone: "success",
        title: "Mapping added",
        message: `${selectedDoctor?.name ?? "The selected doctor"} is now mapped to ${buildRouteLabel(selectedRoute)}.`,
      });
    } catch (e) {
      setNotice(describeApiError(e, "Could not add the doctor-route mapping."));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setNotice({
      tone: "info",
      title: "Removing mapping",
      message: "The doctor-to-route mapping is being removed.",
    });
    try {
      await removeDoctorRoute({
        doctorId: Number(doctorId),
        routeId: Number(routeId),
      });
      setNotice({
        tone: "success",
        title: "Removal processed",
        message: `${selectedDoctor?.name ?? "The selected doctor"} is no longer mapped to ${buildRouteLabel(selectedRoute)}.`,
        detail: "If no mapping existed already, nothing needed to change.",
      });
    } catch (e) {
      setNotice(describeApiError(e, "Could not remove the doctor-route mapping."));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !doctorId || !routeId;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Doctor Route mapping</h1>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <div className="space-y-4">
          {notice ? <NoticeBanner notice={notice} /> : null}

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-zinc-700">Doctor</div>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              >
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-zinc-700">Route</div>
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              >
                <option value="">Select route…</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.territoryName} / {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </label>

            <button
              disabled={disabled}
              onClick={onAdd}
              className={[
                "h-10 rounded-xl px-5 text-sm font-medium text-white",
                "bg-green-500 hover:bg-green-600",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "focus:outline-none focus:ring-4 focus:ring-emerald-200",
              ].join(" ")}
            >
              {busy ? "Working…" : "Add"}
            </button>

            <button
              disabled={disabled}
              onClick={onRemove}
              className={[
                "h-10 rounded-xl px-5 text-sm font-medium text-white",
                "bg-red-600 hover:bg-red-700",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "focus:outline-none focus:ring-4 focus:ring-rose-200",
              ].join(" ")}
            >
              {busy ? "Working…" : "Remove"}
            </button>
          </div>

          <p className="text-sm text-zinc-500">
            This MVP panel is intentionally minimal: select a doctor and a route,
            then Add/Remove.
          </p>
        </div>
      </div>
    </div>
  );
}
