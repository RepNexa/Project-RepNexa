"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function FmHome() {
  return (
    <AuthGuard allowedRoles={["FM"]}>
      <div style={{ maxWidth: 760, margin: "24px auto", padding: 24 }}>
        <h1>Field Manager (FM)</h1>
        <div style={{ marginTop: 12 }}>
          FM is authenticated and can access <b>/api/v1/assignments/**</b>, but
          there is no safe route list endpoint for FM (routes are CM-only under
          /admin).
        </div>
        <div style={{ marginTop: 8 }}>
          For the demo, use CM to seed MR assignment.
        </div>
      </div>
    </AuthGuard>
  );
}
