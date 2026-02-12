"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import AdminList from "../../_components/AdminList";

export default function DoctorsPage() {
  return (
    <AppShell title="Admin (CM) – Doctors">
      <RequireRole role="CM">
        <AdminList
          title="GET /api/v1/admin/doctors"
          endpoint="/admin/doctors"
        />
      </RequireRole>
    </AppShell>
  );
}
