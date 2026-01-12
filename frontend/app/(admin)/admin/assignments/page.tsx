"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";
import { AssignmentsPage } from "@/src/features/assignments/components/AssignmentsPage";

export default function Page() {
  return (
    <AuthGuard allowedRoles={["CM"]}>
      <AssignmentsPage />
    </AuthGuard>
  );
}
