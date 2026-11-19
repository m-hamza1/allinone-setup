"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminCrudPage, useAdminToken } from "@/components/AdminCrudPage";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePageSkeleton } from "@/components/loading-skeletons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Profile = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Drawer = "none" | "profile" | "2fa";

export default function ProfileSettingsPage() {
  const { token } = useAdminToken();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [drawer, setDrawer] = useState<Drawer>("none");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<{ data: Profile }>("/profile", { token, timeoutMs: 10000 }),
      api<{ data: { enabled: boolean } }>("/auth/2fa", { token }).catch(() => ({
        data: { enabled: false },
      })),
    ])
      .then(([profileRes, twoFaRes]) => {
        setProfile(profileRes.data);
        setTwoFaEnabled(Boolean(twoFaRes.data.enabled));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed"))
      .finally(() => setHasLoaded(true));
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, string> = {
        name: profile.name,
        email: profile.email,
      };
      if (password.trim()) body.password = password.trim();
      const res = await api<{ data: Profile }>("/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(body),
      });
      setProfile(res.data);
      setPassword("");
      setMessage("Profile saved");
      setDrawer("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function start2fa() {
    if (!token) return;
    setError(null);
    try {
      const res = await api<{ data: { secret: string; otpauth_url: string } }>(
        "/auth/2fa/setup",
        { method: "POST", token },
      );
      setSetupSecret(res.data.secret);
      setOtpauth(res.data.otpauth_url);
      setRecovery(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA setup failed");
    }
  }

  async function confirm2fa() {
    if (!token) return;
    setError(null);
    try {
      const res = await api<{ data: { enabled: boolean; recovery_codes: string[] } }>(
        "/auth/2fa/confirm",
        { method: "POST", token, body: JSON.stringify({ otp }) },
      );
      setTwoFaEnabled(true);
      setSetupSecret(null);
      setOtpauth(null);
      setOtp("");
      setRecovery(res.data.recovery_codes);
      setMessage("2FA enabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    }
  }

  async function disable2fa() {
    if (!token) return;
    setError(null);
    try {
      await api("/auth/2fa/disable", {
        method: "POST",
        token,
        body: JSON.stringify({ otp }),
      });
      setTwoFaEnabled(false);
      setOtp("");
      setMessage("2FA disabled");
      setDrawer("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable 2FA");
    }
  }

  if (!token) return <TablePageSkeleton rows={4} />;

  return (
    <AdminCrudPage title="Profile" description="Your staff profile, password, and 2FA.">
      {!hasLoaded || !profile ? (
        <TablePageSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {error && drawer === "none" ? (
            <p className="text-danger text-sm">{error}</p>
          ) : null}
          {message && drawer === "none" ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}

          <article className="border-border bg-surface flex flex-wrap items-start justify-between gap-3 rounded-[3px] border p-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium">{profile.name}</h2>
              <p className="text-muted-foreground text-sm">{profile.email}</p>
              <p className="text-muted-foreground text-xs capitalize">Role: {profile.role}</p>
            </div>
            <Button type="button" size="sm" onClick={() => setDrawer("profile")}>
              Edit profile
            </Button>
          </article>

          <article className="border-border bg-surface flex flex-wrap items-start justify-between gap-3 rounded-[3px] border p-5">
            <div className="space-y-1">
              <h2 className="text-base font-medium">Two-factor authentication</h2>
              <p className="text-muted-foreground text-sm">
                Status: {twoFaEnabled ? "Enabled" : "Off"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={twoFaEnabled ? "outline" : "default"}
              onClick={() => {
                setError(null);
                setDrawer("2fa");
                if (!twoFaEnabled && !setupSecret) void start2fa();
              }}
            >
              {twoFaEnabled ? "Manage 2FA" : "Set up 2FA"}
            </Button>
          </article>

          {recovery ? (
            <article className="border-border bg-surface rounded-[3px] border p-5 text-sm">
              <p className="mb-2 font-medium">Recovery codes (store safely):</p>
              <ul className="font-mono text-xs">
                {recovery.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      )}

      <Sheet open={drawer === "profile"} onOpenChange={(o) => !o && setDrawer("none")}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit profile</SheetTitle>
            <SheetDescription>Name, email, and optional password change.</SheetDescription>
          </SheetHeader>
          {profile ? (
            <form onSubmit={onSave} className="mt-6 space-y-4 px-4 pb-6">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Name</span>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Email</span>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  required
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">New password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep"
                />
              </label>
              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={drawer === "2fa"} onOpenChange={(o) => !o && setDrawer("none")}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{twoFaEnabled ? "Manage 2FA" : "Set up 2FA"}</SheetTitle>
            <SheetDescription>Authenticator app codes for your login.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-4 pb-6">
            {!twoFaEnabled && setupSecret ? (
              <div className="space-y-3 text-sm">
                <p>Add this secret in your authenticator app:</p>
                <code className="block break-all rounded-[3px] bg-black/5 p-2 font-mono text-xs">
                  {setupSecret}
                </code>
                {otpauth ? (
                  <p className="text-muted-foreground break-all text-xs">{otpauth}</p>
                ) : null}
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                />
                <Button type="button" className="w-full" onClick={() => void confirm2fa()}>
                  Confirm & enable
                </Button>
              </div>
            ) : null}

            {twoFaEnabled ? (
              <div className="space-y-3">
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Code to disable"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void disable2fa()}
                >
                  Disable 2FA
                </Button>
              </div>
            ) : null}

            {!twoFaEnabled && !setupSecret ? (
              <Button type="button" className="w-full" onClick={() => void start2fa()}>
                Generate secret
              </Button>
            ) : null}

            {error ? <p className="text-danger text-sm">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>
        </SheetContent>
      </Sheet>
    </AdminCrudPage>
  );
}
