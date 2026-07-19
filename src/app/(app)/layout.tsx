import { AppShell } from "@/components/layout/app-shell";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentAppIdentity();
  return <AppShell identity={identity}>{children}</AppShell>;
}
