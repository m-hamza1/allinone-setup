"use client";

import { SettingsResourcePage } from "@/components/SettingsResourcePage";

export default function BotsPage() {
  return (
    <SettingsResourcePage
      title="Bots"
      description="Webhook and FAQ bots that can greet or hand off conversations."
      path="/agent-bots"
      createLabel="Add bot"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "bot_type", label: "Type", placeholder: "webhook" },
        { key: "outgoing_url", label: "Outgoing URL", placeholder: "https://…" },
      ]}
      mapBody={(form) => ({
        name: form.name,
        bot_type: form.bot_type || "webhook",
        outgoing_url: form.outgoing_url || null,
        active: true,
      })}
      renderMeta={(item) => (
        <span>
          {item.bot_type} · {item.active ? "active" : "off"}
          {item.outgoing_url ? ` · ${item.outgoing_url}` : ""}
        </span>
      )}
    />
  );
}
