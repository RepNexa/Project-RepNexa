"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function RepLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={["MR"]}>{children}</AuthGuard>;
}
