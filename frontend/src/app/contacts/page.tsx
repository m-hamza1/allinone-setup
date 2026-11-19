"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingSkeleton } from "@/components/loading-skeletons";

export default function ContactsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff/contacts");
  }, [router]);
  return <PageLoadingSkeleton />;
}
