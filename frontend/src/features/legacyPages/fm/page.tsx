"use client";

import AppShell from "../_components/AppShell";
import RequireRole from "../_components/RequireRole";

export default function FmHome() {
  return (
    <AppShell title="Field Manager (FM)">
      <RequireRole role="FM">
        <div className="rounded border bg-white p-4 text-sm text-zinc-700">
          FM is authenticated and can access <b>/api/v1/assignments/**</b>, but
          there is no safe route list endpoint for FM (routes are CM-only under
          /admin).
          <div className="mt-2">
            For the demo, use CM to seed MR assignment (script in section 6).
          </div>
        </div>
      </RequireRole>
    </AppShell>
  );
}
