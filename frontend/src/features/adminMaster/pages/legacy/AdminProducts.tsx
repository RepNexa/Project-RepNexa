"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";
import RequireRole from "@/src/features/shared/components/legacy/RequireRole";
import AdminList from "@/src/features/shared/components/legacy/AdminList";

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
