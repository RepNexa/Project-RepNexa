"use client";

import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function HoLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={["FM"]}>{children}</AuthGuard>;
}
