import { apiFetch, clearCsrfTokenCache } from "@/src/lib/api/client";

export type Role = "CM" | "FM" | "MR";

export type MeResponse = {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
};

export async function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", { method: "GET", requireCsrf: false });
}

export async function login(
  username: string,
  password: string
): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
  clearCsrfTokenCache();
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}
