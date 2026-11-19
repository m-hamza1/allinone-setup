export type ChannelKey =
  | "website"
  | "email"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "sms"
  | "telegram"
  | "api"
  | "twitter"
  | "line";

export type CredField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  optional?: boolean;
};

export type ChannelDefinition = {
  key: ChannelKey;
  title: string;
  description: string;
  accent: string;
  badge?: string;
  fields: CredField[];
  inboxNameDefault: string;
};

/** Chatwoot-style channel picker catalog (Allin branding). */
export const CHANNEL_CATALOG: ChannelDefinition[] = [
  {
    key: "website",
    title: "Website",
    description: "Live chat widget for your site — embed snippet after create.",
    accent: "#0f6e56",
    fields: [],
    inboxNameDefault: "Website",
  },
  {
    key: "email",
    title: "Email",
    description: "Receive and reply to customer emails from the shared inbox.",
    accent: "#2563eb",
    fields: [
      { key: "imap_host", label: "IMAP host", placeholder: "imap.gmail.com" },
      { key: "imap_port", label: "IMAP port", placeholder: "993", optional: true },
      { key: "username", label: "Username", placeholder: "support@company.com" },
      { key: "password", label: "Password / app password", placeholder: "••••••••", type: "password" },
      { key: "from_email", label: "From email", placeholder: "support@company.com", optional: true },
      { key: "from_name", label: "From name", placeholder: "Support", optional: true },
      { key: "smtp_host", label: "SMTP host", placeholder: "smtp.gmail.com", optional: true },
      { key: "smtp_port", label: "SMTP port", placeholder: "587", optional: true },
    ],
    inboxNameDefault: "Email",
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Connect WhatsApp Cloud API so chats land in Allin.",
    accent: "#16a34a",
    badge: "Cloud API",
    fields: [
      { key: "access_token", label: "Access token", placeholder: "EAAG…", type: "password" },
      { key: "phone_number_id", label: "Phone number ID", placeholder: "1234567890" },
      { key: "verify_token", label: "Webhook verify token", placeholder: "allin-verify-token" },
      { key: "waba_id", label: "WhatsApp Business Account ID", placeholder: "Optional", optional: true },
    ],
    inboxNameDefault: "WhatsApp",
  },
  {
    key: "facebook",
    title: "Facebook",
    description: "Messenger conversations into your support inbox.",
    accent: "#1877f2",
    fields: [
      { key: "access_token", label: "Page access token", placeholder: "EAAG…", type: "password" },
      { key: "page_id", label: "Facebook Page ID", placeholder: "1234567890" },
      { key: "verify_token", label: "Webhook verify token", placeholder: "allin-verify-token", optional: true },
    ],
    inboxNameDefault: "Facebook",
  },
  {
    key: "instagram",
    title: "Instagram",
    description: "Direct messages from Instagram Business accounts.",
    accent: "#db2777",
    fields: [
      { key: "access_token", label: "Access token", placeholder: "EAAG…", type: "password" },
      { key: "page_id", label: "Linked Facebook Page ID", placeholder: "1234567890" },
      { key: "verify_token", label: "Webhook verify token", placeholder: "allin-verify-token", optional: true },
      { key: "ig_user_id", label: "Instagram user ID", placeholder: "Optional", optional: true },
    ],
    inboxNameDefault: "Instagram",
  },
  {
    key: "sms",
    title: "SMS",
    description: "Twilio SMS channel for text support.",
    accent: "#7c3aed",
    badge: "Twilio",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxx" },
      { key: "auth_token", label: "Auth token", placeholder: "••••••••", type: "password" },
      { key: "from_number", label: "From number", placeholder: "+15551234567" },
    ],
    inboxNameDefault: "SMS",
  },
  {
    key: "telegram",
    title: "Telegram",
    description: "Telegram Bot API inbox for chats and groups.",
    accent: "#229ED9",
    badge: "Bot",
    fields: [
      { key: "bot_token", label: "Bot token", placeholder: "123456:ABC…", type: "password" },
    ],
    inboxNameDefault: "Telegram",
  },
  {
    key: "api",
    title: "API channel",
    description: "Generic HTTP ingest/outbound for custom apps.",
    accent: "#334155",
    badge: "Developer",
    fields: [
      { key: "webhook_token", label: "Inbound webhook token", placeholder: "shared-secret", optional: true },
      { key: "outbound_url", label: "Outbound webhook URL", placeholder: "https://example.com/hook", optional: true },
    ],
    inboxNameDefault: "API",
  },
  {
    key: "twitter",
    title: "Twitter / X",
    description: "Direct messages via X API credentials.",
    accent: "#0f1419",
    badge: "X",
    fields: [
      { key: "bearer_token", label: "Bearer token", placeholder: "AAAA…", type: "password" },
      { key: "dm_url", label: "DM send URL (optional override)", placeholder: "https://api.twitter.com/…", optional: true },
    ],
    inboxNameDefault: "Twitter",
  },
  {
    key: "line",
    title: "LINE",
    description: "LINE Messaging API channel.",
    accent: "#06C755",
    fields: [
      { key: "channel_access_token", label: "Channel access token", placeholder: "…", type: "password" },
      { key: "channel_secret", label: "Channel secret", placeholder: "…", type: "password", optional: true },
    ],
    inboxNameDefault: "LINE",
  },
];

export function channelDef(key: string) {
  return CHANNEL_CATALOG.find((c) => c.key === key);
}
