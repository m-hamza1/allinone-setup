"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  BotIcon,
  Code2Icon,
  FileTextIcon,
  FolderOpenIcon,
  KeyRoundIcon,
  LockIcon,
  PlugIcon,
  RadioIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TagIcon,
  UserCheckIcon,
  UserIcon,
  UserRoundCogIcon,
  UsersIcon,
  UsersRoundIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    title: "Account",
    items: [
      { href: "/admin/settings/account", title: "Account settings", icon: SlidersHorizontalIcon },
      { href: "/admin/settings/profile", title: "Profile", icon: UserIcon },
      { href: "/admin/settings/security", title: "Security", icon: LockIcon },
      { href: "/admin/settings/platform", title: "Platform API", icon: KeyRoundIcon },
      { href: "/admin/settings/captain", title: "Captain", icon: SparklesIcon },
    ],
  },
  {
    title: "Staff",
    items: [
      { href: "/admin/team", title: "Staff", icon: UsersIcon },
      { href: "/admin/agent-teams", title: "Teams", icon: UsersRoundIcon },
      { href: "/admin/settings/assignment", title: "Assignment", icon: UserCheckIcon },
      { href: "/admin/settings/roles", title: "Custom roles", icon: UserRoundCogIcon },
      { href: "/admin/settings/views", title: "Custom views", icon: FolderOpenIcon },
    ],
  },
  {
    title: "Inboxes",
    items: [
      { href: "/admin/settings/channels", title: "Inboxes", icon: RadioIcon },
      { href: "/admin/inboxes", title: "Website", icon: Settings2Icon },
      { href: "/admin/settings/widget", title: "Applications", icon: Code2Icon },
      { href: "/admin/settings/integrations", title: "Integrations", icon: PlugIcon },
    ],
  },
  {
    title: "Productivity",
    items: [
      { href: "/admin/settings/automations", title: "Automation", icon: BellIcon },
      { href: "/admin/settings/bots", title: "Bots", icon: BotIcon },
      { href: "/admin/macros", title: "Macros", icon: WorkflowIcon },
      { href: "/admin/canned", title: "Canned responses", icon: ZapIcon },
      { href: "/admin/settings/templates", title: "Templates", icon: FileTextIcon },
      { href: "/admin/labels", title: "Labels", icon: TagIcon },
      { href: "/admin/settings/attributes", title: "Custom attributes", icon: TagIcon },
      { href: "/admin/settings/sla", title: "SLA", icon: ShieldIcon },
    ],
  },
  {
    title: "Audit",
    items: [
      { href: "/admin/settings/audit", title: "Audit logs", icon: ScrollTextIcon },
    ],
  },
] as const;

export const SETTINGS_PATHS = groups.flatMap((group) => group.items.map((item) => item.href));

export function isSettingsSurface(pathname: string) {
  if (pathname === "/admin/settings" || pathname.startsWith("/admin/settings/")) return true;
  return SETTINGS_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function SettingsFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-surface flex h-full min-h-0">
      <aside className="border-border flex w-[220px] shrink-0 flex-col border-r bg-[#f8fafc]">
        <div className="flex h-12 items-center px-4 text-sm font-medium">Settings</div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-8 items-center gap-2 rounded-md px-2 text-[13px]",
                          active
                            ? "bg-[#e7edf5] font-medium text-[#15202b]"
                            : "text-[#3d4a5c] hover:bg-white",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
