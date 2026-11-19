"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, User } from "@/lib/api";
import { homeForRole } from "@/lib/portals";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/components/AuthProvider";

type LoginResponse = {
  token?: string;
  user?: User;
  requires_2fa?: boolean;
  challenge?: string;
  must_enroll_2fa?: boolean;
  message?: string;
};

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { setSession } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resetOk = search.get("reset") === "1";

  async function finish(token: string, user: User, mustEnroll?: boolean) {
    setSession(token, user);
    if (mustEnroll) {
      router.replace("/admin/settings/profile?enroll_2fa=1");
      return;
    }
    router.replace(homeForRole(user.role));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (challenge) {
        const data = await api<LoginResponse>("/auth/2fa/verify", {
          method: "POST",
          body: JSON.stringify({ challenge, otp }),
        });
        if (data.token && data.user) {
          await finish(data.token, data.user);
        }
        return;
      }

      const data = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, otp: otp || undefined }),
      });

      if (data.requires_2fa && data.challenge) {
        setChallenge(data.challenge);
        setError(null);
        return;
      }

      if (data.token && data.user) {
        await finish(data.token, data.user, data.must_enroll_2fa);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function startGoogle() {
    setError(null);
    try {
      const res = await api<{ data: { url: string } }>("/auth/sso/google/redirect");
      window.location.href = res.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google SSO not configured");
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#10233a] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,110,86,0.4),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.08),transparent_28%)]" />
        <div className="relative">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] mb-10 inline-block text-3xl tracking-tight"
          >
            Allin
          </Link>
          <h1 className="font-[family-name:var(--font-display)] max-w-md text-5xl leading-tight">
            Sign in. Land in the right place.
          </h1>
        </div>
        <p className="relative max-w-sm text-sm leading-relaxed text-white/70">
          Admins open the dashboard. Staff open the inbox. Same login — role decides
          the path.
        </p>
      </section>

      <section className="grid place-items-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="ui-panel w-full max-w-md p-8 shadow-[var(--shadow)]"
        >
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-foreground mb-6 inline-block text-xl lg:hidden"
          >
            Allin
          </Link>
          <p className="text-muted-foreground mb-2 text-xs tracking-[0.18em] uppercase">
            Sign in
          </p>
          <h2 className="font-[family-name:var(--font-display)] mb-2 text-3xl">
            {challenge ? "Two-factor code" : "Welcome back"}
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">
            {challenge
              ? "Enter the 6-digit code from your authenticator app."
              : "Staff → inbox · Admin → dashboard"}
          </p>

          {!challenge ? (
            <>
              <details className="mb-5">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  Demo accounts
                </summary>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ["staff@allin.test", "Staff"],
                    ["admin@allin.test", "Admin"],
                    ["super@allin.test", "Super"],
                  ].map(([mail, label]) => (
                    <Button
                      key={mail}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmail(mail);
                        setPassword("password");
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </details>

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

              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm" htmlFor="password">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground text-xs hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-input mb-4"
                autoComplete="current-password"
                required
              />
            </>
          ) : null}

          {resetOk && !error ? (
            <p className="mb-4 text-sm text-emerald-700">
              Password updated. Sign in with your new password.
            </p>
          ) : null}

          {(challenge || otp) && (
            <>
              <label className="mb-1 block text-sm" htmlFor="otp">
                Authenticator code
              </label>
              <input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="ui-input mb-4"
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </>
          )}

          {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Signing in…" : challenge ? "Verify" : "Sign in"}
          </Button>

          {!challenge ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void startGoogle()}
            >
              Continue with Google
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => {
                setChallenge(null);
                setOtp("");
              }}
            >
              Back
            </Button>
          )}

          <p className="text-muted-foreground mt-6 text-center text-sm">
            New here?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Create a workspace
            </Link>
          </p>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Customer?{" "}
            <Link href="/user" className="text-primary hover:underline">
              Open user chat
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
