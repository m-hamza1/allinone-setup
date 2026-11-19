"use client";

import { PortalShell } from "@/components/PortalShell";
import { useAuth } from "@/lib/useAuth";
import { STAFF_NAV } from "@/lib/nav";

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { token, user, logout } = useAuth({
    roles: ["staff", "admin", "super_admin"],
  });

  // Always render children so Cache Components / instant-nav validation can see
  // the route segment (returning null drops the page from the tree).
  if (!token) {
    return <>{children}</>;
  }

  return (
    <PortalShell
      brand="Allin"
      eyebrow="Workspace"
      homeHref="/staff/inbox"
      nav={STAFF_NAV}
      user={user}
      onLogout={logout}
    >
      {children}
    </PortalShell>
  );
}

export function useStaffAuth() {
  return useAuth({ roles: ["staff", "admin", "super_admin"] });
}
