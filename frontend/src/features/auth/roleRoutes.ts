import type { Role } from "./api";

export function routeForRole(role: Role): string {
  switch (role) {
    case "MR":
      return "/rep";
    case "FM":
      return "/ho/overview";
    case "CM":
      return "/ho/overview";
    default:
      return "/login";
  }
}
