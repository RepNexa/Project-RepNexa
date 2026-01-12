"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { TerritoriesPage } from "@/src/features/adminGeo/components/TerritoriesPage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["CM"]}>
      <TerritoriesPage />
    </AuthGuard>
  );
}
