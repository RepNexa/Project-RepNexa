"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";

export default function RepLayout({ children }: { children: React.ReactNode }) {
  return <AppShell allowedRoles={["MR"]}>{children}</AppShell>;
}
