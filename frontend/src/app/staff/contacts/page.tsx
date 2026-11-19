"use client";

import { ContactsWorkspace } from "@/components/ContactsWorkspace";
import { useStaffAuth } from "@/components/StaffShell";
import { TablePageSkeleton } from "@/components/loading-skeletons";

export default function StaffContactsPage() {
  const { token } = useStaffAuth();
  if (!token) return <TablePageSkeleton rows={6} />;
  return <ContactsWorkspace token={token} inboxHref="/staff/inbox" />;
}
