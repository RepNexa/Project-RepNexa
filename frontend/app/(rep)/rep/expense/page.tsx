"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { ExpensePage } from "@/src/features/repChemist/pages/ExpensePage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["MR"]}>
      <ExpensePage />
    </AuthGuard>
  );
}
