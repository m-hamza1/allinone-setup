import {
  AtSignIcon,
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  BotIcon,
  ClockIcon,
  ContactIcon,
  FileTextIcon,
  InboxIcon,
  KeyRoundIcon,
  LockIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PlugIcon,
  RadioIcon,
  RepeatIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
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
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Same conversation tree Chatwoot shows under Conversations. */
const CONVERSATION_CHILDREN: NavItem[] = [
  { href: "/staff/inbox", label: "All conversations", icon: InboxIcon },
  { href: "/staff/mentions", label: "Mentions", icon: AtSignIcon },
  { href: "/staff/participating", label: "Participating", icon: UserCheckIcon },
  { href: "/staff/unattended", label: "Unattended", icon: ClockIcon },
];

export const STAFF_NAV: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Conversations",
        icon: MessageSquareIcon,
        children: CONVERSATION_CHILDREN,
      },
      { href: "/staff/contacts", label: "Contacts", icon: ContactIcon },
      { href: "/staff/canned", label: "Canned responses", icon: ZapIcon },
    ],
  },
];

/**
 * Chatwoot's primary sidebar: one tree for work and settings.
 * Pages that do not exist yet are omitted.
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Conversations",
        icon: MessageSquareIcon,
        children: CONVERSATION_CHILDREN,
      },
      { href: "/admin/contacts", label: "Contacts", icon: ContactIcon },
      { href: "/admin/reports", label: "Reports", icon: BarChart3Icon },
      { href: "/admin/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { href: "/admin/help-center", label: "Help Center", icon: BookOpenIcon },
      { href: "/admin/settings/captain", label: "Captain", icon: SparklesIcon },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/settings/account", label: "Account settings", icon: SettingsIcon },
      { href: "/admin/settings/profile", label: "Profile", icon: UserIcon },
      { href: "/admin/team", label: "Staff", icon: UsersIcon },
      { href: "/admin/agent-teams", label: "Teams", icon: UsersRoundIcon },
      { href: "/admin/settings/assignment", label: "Assignment", icon: UserRoundCogIcon },
      { href: "/admin/settings/channels", label: "Inboxes", icon: RadioIcon },
      { href: "/admin/settings/templates", label: "Templates", icon: FileTextIcon },
      { href: "/admin/labels", label: "Labels", icon: TagIcon },
      { href: "/admin/settings/attributes", label: "Custom attributes", icon: TagIcon },
      { href: "/admin/settings/automations", label: "Automation", icon: RepeatIcon },
      { href: "/admin/settings/bots", label: "Bots", icon: BotIcon },
      { href: "/admin/macros", label: "Macros", icon: WorkflowIcon },
      { href: "/admin/canned", label: "Canned responses", icon: ZapIcon },
      { href: "/admin/settings/integrations", label: "Integrations", icon: PlugIcon },
      { href: "/admin/settings/audit", label: "Audit logs", icon: ScrollTextIcon },
      { href: "/admin/settings/roles", label: "Custom roles", icon: ShieldIcon },
      { href: "/admin/settings/sla", label: "SLA", icon: BellIcon },
      { href: "/admin/settings/security", label: "Security", icon: LockIcon },
      { href: "/admin/settings/platform", label: "Platform API", icon: KeyRoundIcon },
    ],
  },
];

function flatten(items: NavItem[]): Array<{ href: string; label: string }> {
  return items.flatMap((item) => [
    ...(item.href ? [{ href: item.href, label: item.label }] : []),
    ...(item.children ? flatten(item.children) : []),
  ]);
}

/** @deprecated use STAFF_NAV */
export const STAFF_LINKS = flatten(STAFF_NAV.flatMap((g) => g.items));

/** @deprecated use ADMIN_NAV */
export const ADMIN_LINKS = flatten(ADMIN_NAV.flatMap((g) => g.items));

export function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/staff/inbox") {
    return pathname === "/staff/inbox" || pathname.startsWith("/staff/inbox/");
  }
  if (href === "/admin/settings") {
    return pathname === "/admin/settings" || pathname.startsWith("/admin/settings/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
