"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DecorativeBackground } from "@/components/godui/decorative-background";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Missing reset token. Open the link from your email again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-panel w-full p-8 shadow-[var(--shadow)]">
      <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">
        Choose a new password
      </h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Then sign in with your updated credentials.
      </p>

      <label className="mb-1 block text-sm" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="ui-input mb-4"
        required
      />

      <label className="mb-1 block text-sm" htmlFor="password">
        New password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="ui-input mb-4"
        minLength={8}
        autoComplete="new-password"
        required
      />

      <label className="mb-1 block text-sm" htmlFor="password_confirmation">
        Confirm password
      </label>
      <input
        id="password_confirmation"
        type="password"
        value={passwordConfirmation}
        onChange={(e) => setPasswordConfirmation(e.target.value)}
        className="ui-input mb-4"
        minLength={8}
        autoComplete="new-password"
        required
      />

      {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Updating…" : "Update password"}
      </Button>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="relative isolate min-h-screen">
      <DecorativeBackground
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(15, 110, 86, 0.16), transparent 50%),
            linear-gradient(180deg, #f7faf8 0%, #eef2f0 100%)
          `,
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] mb-8 text-2xl tracking-tight text-[#0a3d30]"
        >
          Allin
        </Link>
        <Suspense fallback={<div className="ui-panel p-8 text-sm">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
