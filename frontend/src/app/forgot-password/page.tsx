"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DecorativeBackground } from "@/components/godui/decorative-background";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.message || "If that email exists, a reset link was sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

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
        <form onSubmit={onSubmit} className="ui-panel w-full p-8 shadow-[var(--shadow)]">
          <h1 className="font-[family-name:var(--font-display)] mb-1 text-3xl">
            Reset password
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Enter your work email. If an account exists, we&apos;ll send a reset link
            (check API logs when mailer is <code className="text-xs">log</code>).
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
            autoComplete="email"
            required
          />
          {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}
          {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
