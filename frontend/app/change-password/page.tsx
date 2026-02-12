"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { changePassword } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await changePassword(currentPassword, newPassword);
      if (me.mustChangePassword) {
        router.replace("/change-password");
        return;
      }
      router.replace(routeForRole(me.role));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "64px auto",
        padding: 24,
        border: "1px solid #ddd",
        borderRadius: 8,
      }}
    >
      <h1 style={{ marginTop: 0 }}>Change Password</h1>
      <p style={{ opacity: 0.8 }}>
        Your account requires a password change before continuing.
      </p>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Current password
          <input
            value={currentPassword}
            type="password"
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="current-password"
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          New password (min 8 chars)
          <input
            value={newPassword}
            type="password"
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="new-password"
          />
        </label>

        <button
          disabled={busy}
          style={{ width: "100%", padding: 10, marginTop: 12 }}
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, color: "crimson" }}>
          <div>
            <strong>{error.code}</strong>
          </div>
          <div>{error.message}</div>
        </div>
      )}
    </div>
  );
}
