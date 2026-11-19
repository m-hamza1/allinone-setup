"use client";

import { MentionsWorkspace } from "@/components/MentionsWorkspace";
import { useStaffAuth } from "@/components/StaffShell";

export default function StaffMentionsPage() {
  const { token, user } = useStaffAuth();
  if (!token) return null;
  return <MentionsWorkspace token={token} user={user} />;
}
