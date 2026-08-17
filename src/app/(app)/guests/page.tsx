import { GuestsView } from "@/components/views/guests-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function GuestsPage() {
  await requirePageAccess("/guests");
  return <GuestsView />;
}
