"use client";

import Link from "next/link";
import { AuthGuard } from "@/src/features/auth/components/AuthGuard";

export default function HoLanding() {
  return (
    <AuthGuard allowedRoles={["FM"]}>
      <div style={{ maxWidth: 760, margin: "24px auto", padding: 24 }}>
        <h1>Field Manager (FM)</h1>
        <p>Login succeeded. You are a Field Manager.</p>
        <Link href="/me">View /me</Link>
      </div>
    </AuthGuard>
  );
}
