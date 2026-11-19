"use client";

import { CannedResponsesWorkspace } from "@/components/CannedResponsesWorkspace";
import { useStaffAuth } from "@/components/StaffShell";

export default function StaffCannedPage() {
  const { token, user } = useStaffAuth();
  if (!token) return null;
  const canManage = Boolean(user?.role);
  return (
    <div className="h-full overflow-y-auto p-4">
      <CannedResponsesWorkspace token={token} canManage={canManage} />
    </div>
  );
}
