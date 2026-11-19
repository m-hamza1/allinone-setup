"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/loading-skeletons";

export default function InboxRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff/inbox");
  }, [router]);
  return <PageLoadingSkeleton />;
}
