"use client";

import { useState } from "react";
import AppShell from "../_components/AppShell";
import { apiFetch, clearCsrfTokenCache } from "../../lib/api/client";
import type { ApiError } from "../../lib/api/types";

type LoginResp = {
  id: number;
  username: string;
  role: string;
  mustChangePassword: boolean;
};
type Me = {
  id: number;
  username: string;
  role: "CM" | "FM" | "MR" | string;
  mustChangePassword: boolean;
};

function formatErr(e: unknown): string {
  const x = e as ApiError;
  if (x && typeof x.status === "number" && typeof x.code === "string") {
    const field = (x.fieldErrors ?? [])
      .map((f) => `${f.field}: ${f.message}`)
      .join("; ");
    return field
      ? `${x.code}: ${x.message} (${field})`
      : `${x.code}: ${x.message}`;
  }
  return "Login failed";
}

export default function LoginPage() {
  const [username, setUsername] = useState("cm@repnexa.local");
  const [password, setPassword] = useState("CM@1234");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    clearCsrfTokenCache();
    try {
      await apiFetch<LoginResp>("/auth/login", {
        method: "POST",
        body: { username, password },
      });

      const me = await apiFetch<Me>("/me", {
        method: "GET",
        requireCsrf: false,
      });

      if (me.role === "CM") window.location.href = "/admin";
      else if (me.role === "MR") window.location.href = "/rep";
      else if (me.role === "FM") window.location.href = "/fm";
      else window.location.href = "/";
    } catch (e2) {
      setMsg(formatErr(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Login">
      <form
        onSubmit={onSubmit}
        className="max-w-md rounded border bg-white p-4"
      >
        <div className="text-sm text-zinc-700">
          Known users (from seed):
          <div className="mt-1 font-mono text-xs">
            CM: cm@repnexa.local / CM@1234
            <br />
            FM: fm@repnexa.local / FM@1234
            <br />
            MR: mr@repnexa.local / MR@1234
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm">Username</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="mt-3">
          <label className="text-sm">Password</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {msg ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {msg}
          </div>
        ) : null}

        <button
          disabled={busy}
          className="mt-4 w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AppShell>
  );
}
