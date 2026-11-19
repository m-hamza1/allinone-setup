"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, User } from "@/lib/api";
import { homeForRole } from "@/lib/portals";
import { useAuthContext } from "@/components/AuthProvider";
import { DecorativeBackground } from "@/components/godui/decorative-background";

type SsoResponse = {
  token: string;
  user: User;
};

function GoogleCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuthContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const oauthError = params.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!code) {
      setError("Missing authorization code from Google.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await api<SsoResponse>("/auth/sso/google/callback", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        if (cancelled) return;
        setSession(data.token, data.user);
        router.replace(homeForRole(data.user.role));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Google sign-in failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router, setSession]);

  return (
    <div className="ui-panel w-full max-w-md p-8 text-center shadow-[var(--shadow)]">
      {error ? (
        <>
          <h1 className="font-[family-name:var(--font-display)] mb-2 text-2xl">
            Google sign-in failed
          </h1>
          <p className="text-danger mb-6 text-sm">{error}</p>
          <Link href="/login" className="text-primary text-sm hover:underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-[family-name:var(--font-display)] mb-2 text-2xl">
            Signing you in…
          </h1>
          <p className="text-muted-foreground text-sm">Finishing Google OAuth.</p>
        </>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <main className="relative isolate min-h-screen">
      <DecorativeBackground
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(15, 110, 86, 0.14), transparent 50%),
            linear-gradient(180deg, #f7faf8 0%, #eef2f0 100%)
          `,
        }}
      />
      <div className="relative z-10 grid min-h-screen place-items-center px-4 py-12">
        <Suspense
          fallback={
            <div className="ui-panel max-w-md p-8 text-center text-sm">Connecting…</div>
          }
        >
          <GoogleCallbackInner />
        </Suspense>
      </div>
    </main>
  );
}
