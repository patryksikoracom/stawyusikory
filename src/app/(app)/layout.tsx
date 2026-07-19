import { AppShell } from "@/components/layout/app-shell";
import { CleaningApp } from "@/components/cleaning/cleaning-app";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentAppIdentity();
  if (identity.role === "cleaning") return <CleaningApp identity={identity} />;
  return <AppShell identity={identity}>{children}</AppShell>;
}
