"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import AdminList from "../../_components/AdminList";

export default function ChemistsPage() {
  return (
    <AppShell title="Admin (CM) – Chemists">
      <RequireRole role="CM">
        <AdminList
          title="GET /api/v1/admin/chemists"
          endpoint="/admin/chemists"
        />
      </RequireRole>
    </AppShell>
  );
}
