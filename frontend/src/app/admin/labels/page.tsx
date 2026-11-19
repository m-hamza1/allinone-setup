"use client";

import { LabelsWorkspace } from "@/components/LabelsWorkspace";
import { useAuth } from "@/lib/useAuth";

export default function AdminLabelsPage() {
  const { token } = useAuth({
    roles: ["admin", "super_admin"],
  });

  if (!token) return null;

  return <LabelsWorkspace token={token} />;
}
