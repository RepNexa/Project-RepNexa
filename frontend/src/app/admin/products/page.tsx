"use client";

import AppShell from "../../_components/AppShell";
import RequireRole from "../../_components/RequireRole";
import AdminList from "../../_components/AdminList";

export default function ProductsPage() {
  return (
    <AppShell title="Admin (CM) – Products">
      <RequireRole role="CM">
        <AdminList
          title="GET /api/v1/admin/products"
          endpoint="/admin/products"
        />
      </RequireRole>
    </AppShell>
  );
}
