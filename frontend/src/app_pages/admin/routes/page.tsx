"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import AdminList from "../../_components/AdminList";

export default function RoutesPage() {
  return (
    <AppShell title="Admin (CM) – Routes">
      <RequireRole role="CM">
        <AdminList title="GET /api/v1/admin/routes" endpoint="/admin/routes" />
      </RequireRole>
    </AppShell>
  );
}
