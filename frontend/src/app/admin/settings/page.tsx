import { redirect } from "next/navigation";

export default function AdminSettingsHomePage() {
  redirect("/admin/settings/account");
}
