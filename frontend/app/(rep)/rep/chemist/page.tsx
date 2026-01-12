"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { ChemistPage } from "@/src/features/repChemist/pages/ChemistPage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["MR"]}>
      <ChemistPage />
    </AuthGuard>
  );
}
