"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { DoctorRouteMapPage } from "@/src/features/doctorRouteMap/pages/DoctorRouteMapPage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["CM"]}>
      <DoctorRouteMapPage />
    </AuthGuard>
  );
}
