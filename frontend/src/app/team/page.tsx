"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/loading-skeletons";

export default function TeamRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/team");
  }, [router]);
  return <PageLoadingSkeleton />;
}
