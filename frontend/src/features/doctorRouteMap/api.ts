import { apiFetch } from "@/src/lib/api/client";

export async function addDoctorRoute(input: {
  doctorId: number;
  routeId: number;
}): Promise<void> {
  await apiFetch<void>("/assignments/doctor-routes", {
    method: "POST",
    body: input,
  });
}

export async function removeDoctorRoute(input: {
  doctorId: number;
  routeId: number;
}): Promise<void> {
  const qs = `?doctorId=${encodeURIComponent(
    String(input.doctorId)
  )}&routeId=${encodeURIComponent(String(input.routeId))}`;
  await apiFetch<void>(`/assignments/doctor-routes${qs}`, { method: "DELETE" });
}
