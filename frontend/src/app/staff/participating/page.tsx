"use client";

import { ConversationFilterPage } from "@/components/ConversationFilterPage";
import { useStaffAuth } from "@/components/StaffShell";

export default function ParticipatingPage() {
  const { token } = useStaffAuth();
  if (!token) return null;
  return (
    <ConversationFilterPage
      token={token}
      title="Participating"
      description="Conversations you have replied to"
      query="participating=1&status=open"
    />
  );
}
