import { User } from "@/lib/api";

export type Portal = "user" | "staff" | "admin";

export function homeForRole(role: User["role"] | undefined): string {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "staff") return "/staff/inbox";
  return "/login";
}

export function canAccessAdmin(role: User["role"] | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function canAccessStaff(role: User["role"] | undefined): boolean {
  return role === "staff" || role === "admin" || role === "super_admin";
}
