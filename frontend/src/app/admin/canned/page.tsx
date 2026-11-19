"use client";

import { CannedResponsesWorkspace } from "@/components/CannedResponsesWorkspace";
import { useAuth } from "@/lib/useAuth";

export default function AdminCannedPage() {
  const { token } = useAuth({
    roles: ["admin", "super_admin"],
  });

  if (!token) return null;

  return <CannedResponsesWorkspace token={token} canManage />;
}
