import { BookingsView } from "@/components/views/bookings-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [identity, { view }] = await Promise.all([requirePageAccess("/bookings"), searchParams]);
  return <BookingsView initialView={view === "sheet" ? "sheet" : "list"} role={identity.role} />;
}
