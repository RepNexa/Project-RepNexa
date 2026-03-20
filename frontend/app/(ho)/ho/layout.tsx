"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";

export default function HoLayout({ children }: { children: React.ReactNode }) {
  // Milestone 6: HO must be accessible by both CM and FM.
  // Backend enforces scope; this is UX gating + consistent shell.
  return (
    <AppShell allowedRoles={["FM", "CM"]} navigationMode="push">
      {children}
    </AppShell>
  );
}
