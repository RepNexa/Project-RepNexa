"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import AdminList from "@/src/features/shared/components/legacy/AdminList";

export default function TerritoriesPage() {
  return (
    <AppShell title="Admin (CM) – Territories">
      <RequireRole role="CM">
        <AdminList
          title="GET /api/v1/admin/territories"
          endpoint="/admin/territories"
        />
      </RequireRole>
    </AppShell>
  );
}
