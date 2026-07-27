import { DashboardView } from "@/components/views/dashboard-view";
import { getCurrentAppIdentity } from "@/lib/auth/current-identity";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const identity = await getCurrentAppIdentity();
  if (identity.role === "manager") redirect("/calendar");
  return <DashboardView />;
}
