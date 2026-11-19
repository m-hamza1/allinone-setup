"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/loading-skeletons";

export default function InboxesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/inboxes");
  }, [router]);
  return <PageLoadingSkeleton />;
}
