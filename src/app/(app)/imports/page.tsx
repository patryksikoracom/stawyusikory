import { ImportsView } from "@/components/views/imports-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function ImportsPage() {
  await requirePageAccess("/imports");
  return <ImportsView />;
}
