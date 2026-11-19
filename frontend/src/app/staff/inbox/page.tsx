"use client";

import { InboxWorkspace } from "@/components/InboxWorkspace";
import { useStaffAuth } from "@/components/StaffShell";

export default function StaffInboxPage() {
  const { token, user } = useStaffAuth();
  if (!token) return null;
  return <InboxWorkspace token={token} user={user} />;
}
