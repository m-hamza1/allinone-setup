"use client";

import { SettingsResourcePage } from "@/components/SettingsResourcePage";

export default function TemplatesPage() {
  return (
    <SettingsResourcePage
      title="Templates"
      description="Reusable channel templates (WhatsApp / SMS style)."
      path="/message-templates"
      createLabel="Add template"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "channel", label: "Channel", placeholder: "whatsapp" },
        { key: "body", label: "Body", required: true },
        { key: "language", label: "Language", placeholder: "en" },
      ]}
      mapBody={(form) => ({
        name: form.name,
        channel: form.channel || "whatsapp",
        body: form.body,
        language: form.language || "en",
        status: "draft",
      })}
      renderMeta={(item) => (
        <span>
          {item.channel} · {item.language} · {item.status}
          <br />
          {item.body}
        </span>
      )}
    />
  );
}
