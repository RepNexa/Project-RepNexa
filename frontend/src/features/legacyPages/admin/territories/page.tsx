"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import AdminList from "../../_components/AdminList";

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
