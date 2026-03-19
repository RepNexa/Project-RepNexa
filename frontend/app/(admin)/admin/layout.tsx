"use client";

import AppShell from "@/src/features/shared/components/legacy/AppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell allowedRoles={["CM"]}>{children}</AppShell>;
}
