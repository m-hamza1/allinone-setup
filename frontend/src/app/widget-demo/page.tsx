"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/loading-skeletons";

export default function WidgetDemoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/user");
  }, [router]);
  return <PageLoadingSkeleton />;
}
