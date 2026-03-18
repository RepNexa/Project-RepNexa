"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/src/lib/api/types";
import { changePassword } from "@/src/features/auth/api";
import { routeForRole } from "@/src/features/auth/roleRoutes";

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm",
        props.className ?? "",
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-violet-500",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary";
  },
) {
  const v = props.variant ?? "primary";
  const base =
    "h-11 w-full rounded-xl px-4 text-sm font-medium shadow-sm disabled:opacity-50";
  const cls =
    v === "primary"
      ? "bg-violet-600 text-white hover:bg-violet-700"
      : "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50";

  return <button {...props} className={[base, cls].join(" ")} />;
}

function Badge({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        ok
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const rules = useMemo(() => {
    const np = newPassword;
    return {
      minLen: np.length >= 8,
      hasLetter: /[A-Za-z]/.test(np),
      hasNumber: /\d/.test(np),
      notSame: np.length > 0 && np !== currentPassword,
    };
  }, [newPassword, currentPassword]);

  const canSubmit =
    currentPassword.trim().length > 0 &&
    newPassword.trim().length > 0 &&
    rules.minLen &&
    rules.hasLetter &&
    rules.hasNumber &&
    rules.notSame &&
    !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const me = await changePassword(currentPassword, newPassword);

      // If backend still requires change, stay here
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
    <div className="min-h-[calc(100vh-80px)] w-full p-6">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-2xl items-center">
        <Card className="relative w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-white" />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold text-zinc-900">
                  Change password
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Your account requires a password change before continuing.
                </div>
              </div>

              
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-500">
                  Current password
                </div>
                <div className="relative">
                  <Input
                    value={currentPassword}
                    type={showCurrent ? "text" : "password"}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showCurrent ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-zinc-500">
                  New password
                </div>
                <div className="relative">
                  <Input
                    value={newPassword}
                    type={showNew ? "text" : "password"}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    {showNew ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge ok={rules.minLen}>Min 8 characters</Badge>
                  <Badge ok={rules.hasLetter}>Has a letter</Badge>
                  <Badge ok={rules.hasNumber}>Has a number</Badge>
                  <Badge ok={rules.notSame}>Not same as current</Badge>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={!canSubmit} variant="primary">
                  {busy ? "Updating…" : "Update password"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => router.replace("/me")}
                >
                  Back to profile
                </Button>
              </div>
            </form>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-800">
                  {error.code ?? "ERROR"}
                </div>
                <div className="mt-1 text-sm text-red-700">
                  {error.message ?? "Something went wrong. Please try again."}
                </div>
              </div>
            ) : null}

            <div className="mt-6 text-xs text-zinc-500">
              Tip: Use a password you haven’t used before. If you forget it,
              contact the admin to reset your account.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}