"use client";

import { ConversationFilterPage } from "@/components/ConversationFilterPage";
import { useStaffAuth } from "@/components/StaffShell";

export default function UnattendedPage() {
  const { token } = useStaffAuth();
  if (!token) return null;
  return (
    <ConversationFilterPage
      token={token}
      title="Unattended"
      description="Open conversations with no assignee"
      query="unattended=1"
    />
  );
}
