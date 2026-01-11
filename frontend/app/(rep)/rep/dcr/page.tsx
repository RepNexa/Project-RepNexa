"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { DcrPage } from "@/src/features/repDcr/pages/DcrPage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["MR"]}>
      <DcrPage />
    </AuthGuard>
  );
}
