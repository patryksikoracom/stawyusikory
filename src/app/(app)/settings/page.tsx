import { SettingsView } from "@/components/views/settings-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function SettingsPage() {
  const identity = await requirePageAccess("/settings");
  return <SettingsView currentRole={identity.role} />;
}
