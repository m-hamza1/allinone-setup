"use client";

import { SettingsResourcePage } from "@/components/SettingsResourcePage";

export default function AssignmentPolicyPage() {
  return (
    <SettingsResourcePage
      title="Staff assignment"
      description="Round-robin and routing policies for new conversations."
      path="/assignment-policies"
      createLabel="Add policy"
      fields={[
        { key: "name", label: "Name", placeholder: "Default round robin", required: true },
        { key: "strategy", label: "Strategy", placeholder: "round_robin" },
      ]}
      mapBody={(form) => ({
        name: form.name,
        strategy: form.strategy || "round_robin",
        active: true,
      })}
      renderMeta={(item) => (
        <span>
          {item.strategy} · {item.active ? "active" : "paused"}
        </span>
      )}
    />
  );
}
