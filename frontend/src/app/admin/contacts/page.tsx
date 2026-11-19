"use client";

import { ContactsWorkspace } from "@/components/ContactsWorkspace";
import { useAuth } from "@/lib/useAuth";
import { TablePageSkeleton } from "@/components/loading-skeletons";

export default function AdminContactsPage() {
  const { token } = useAuth({
    roles: ["admin", "super_admin"],
  });

  if (!token) return <TablePageSkeleton rows={6} />;

  return <ContactsWorkspace token={token} inboxHref="/staff/inbox" />;
}
