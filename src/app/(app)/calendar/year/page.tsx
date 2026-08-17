import { AnnualOverviewView } from "@/components/views/annual-overview-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function CalendarYearPage() {
  await requirePageAccess("/calendar/year");
  return <AnnualOverviewView />;
}
