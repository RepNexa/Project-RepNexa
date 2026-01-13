"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard allowedRoles={["CM"]}>{children}</AuthGuard>;
}
