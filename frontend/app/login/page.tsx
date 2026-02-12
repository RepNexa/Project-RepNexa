"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { login } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("cm@repnexa.local");
  const [password, setPassword] = useState("CM@1234");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(username, password);
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
      <h1 style={{ marginTop: 0 }}>Login</h1>

      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="username"
          />
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>
          Password
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            autoComplete="current-password"
          />
        </label>

        <button
          disabled={busy}
          style={{ width: "100%", padding: 10, marginTop: 12 }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, color: "crimson" }}>
          <div>
            <strong>{error.code}</strong>
          </div>
          <div>{error.message}</div>
          {error.requestId ? (
            <div style={{ opacity: 0.8 }}>RequestId: {error.requestId}</div>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
        Dev users: cm@repnexa.local / CM@1234 • fm@repnexa.local / FM@1234 •
        mr@repnexa.local / MR@1234
      </div>
    </div>
  );
}
