import { FinancesView } from "@/components/views/finances-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function FinancesPage() {
  await requirePageAccess("/finances");
  return <FinancesView />;
}
