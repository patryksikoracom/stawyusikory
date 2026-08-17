import { CalendarView } from "@/components/views/calendar-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function CalendarPage() {
  const identity = await requirePageAccess("/calendar");
  return <CalendarView role={identity.role ?? "viewer"} />;
}
