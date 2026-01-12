import type { Role } from "./api";

export function routeForRole(role: Role): string {
  switch (role) {
    case "MR":
      return "/rep";
    case "FM":
      return "/ho";
    case "CM":
      return "/admin";
    default:
      return "/login";
  }
}
