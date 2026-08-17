import { DashboardView } from "@/components/views/dashboard-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function DashboardPage() {
  await requirePageAccess("/dashboard");
  return <DashboardView />;
}
