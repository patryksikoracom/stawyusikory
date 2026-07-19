import { SettingsView } from "@/components/views/settings-view";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";

export default async function SettingsPage() {
  const identity = await getCurrentAppIdentity();
  return <SettingsView currentRole={identity.role} />;
}
