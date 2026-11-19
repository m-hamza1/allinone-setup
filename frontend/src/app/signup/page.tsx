"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, User } from "@/lib/api";
import { homeForRole } from "@/lib/portals";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/AuthProvider";
import { DecorativeBackground } from "@/components/godui/decorative-background";

type RegisterResponse = {
  token: string;
  user: User;
};

export default function SignupPage() {
  const router = useRouter();
  const { setSession } = useAuthContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          workspace,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      setSession(data.token, data.user);
      router.replace(homeForRole(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen">
      <DecorativeBackground
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 15% 20%, rgba(15, 110, 86, 0.18), transparent 50%),
            radial-gradient(ellipse 50% 40% at 90% 80%, rgba(16, 35, 58, 0.08), transparent 45%),
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
            Create your workspace
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            You&apos;ll sign in as admin and land on the dashboard. Invite staff later
            from Team.
          </p>

          <label className="mb-1 block text-sm" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ui-input mb-4"
            autoComplete="name"
            required
          />

          <label className="mb-1 block text-sm" htmlFor="email">
            Work email
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

          <label className="mb-1 block text-sm" htmlFor="workspace">
            Workspace name
          </label>
          <input
            id="workspace"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="ui-input mb-4"
            placeholder="Acme Support"
            required
          />

          <label className="mb-1 block text-sm" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ui-input mb-4"
            autoComplete="new-password"
            minLength={8}
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
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Creating…" : "Create workspace"}
          </Button>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
