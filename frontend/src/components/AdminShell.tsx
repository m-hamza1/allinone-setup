"use client";

import { PortalShell } from "@/components/PortalShell";
import { useAuth } from "@/lib/useAuth";
import { ADMIN_NAV } from "@/lib/nav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { token, user, logout } = useAuth({ roles: ["admin", "super_admin"] });

  // Always render children so Cache Components / instant-nav validation can see
  // the route segment (returning null drops the page from the tree).
  if (!token) {
    return <>{children}</>;
  }

  return (
    <PortalShell
      brand="Allin"
      eyebrow="Admin"
      homeHref="/staff/inbox"
      nav={ADMIN_NAV}
      user={user}
      onLogout={logout}
      contentClassName="admin-surface"
    >
      {children}
    </PortalShell>
  );
}
