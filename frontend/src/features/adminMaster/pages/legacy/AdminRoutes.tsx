"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import AdminList from "@/src/features/shared/components/legacy/AdminList";

export default function RoutesPage() {
  return (
    <AppShell title="Admin (CM) – Routes">
      <RequireRole role="CM">
        <AdminList title="Routes" endpoint="/admin/routes" />
      </RequireRole>
    </AppShell>
  );
}
