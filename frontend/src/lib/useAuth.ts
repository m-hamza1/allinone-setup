"use client";

import { useEffect } from "react";
import { User } from "@/lib/api";
import { useAuthContext } from "@/components/AuthProvider";

export function useAuth(options?: {
  roles?: Array<User["role"]>;
  redirectTo?: string;
}) {
  const { token, user, ready, refreshing, logout, ensureRole } = useAuthContext();
  const rolesKey = options?.roles?.join(",") ?? "";

  useEffect(() => {
    if (!ready) return;
    ensureRole(options?.roles, options?.redirectTo);
  }, [ready, rolesKey, ensureRole, options?.roles, options?.redirectTo]);

  return {
    token,
    user,
    loading: !ready,
    refreshing,
    logout,
  };
}
