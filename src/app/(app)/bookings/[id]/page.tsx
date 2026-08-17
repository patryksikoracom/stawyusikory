import { BookingsView } from "@/components/views/bookings-view";
import { requirePageAccess } from "@/lib/auth/require-page-access";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [identity, { id }, { tab }] = await Promise.all([requirePageAccess("/bookings/detail"), params, searchParams]);
  return <BookingsView initialId={decodeURIComponent(id)} initialTab={tab === "messages" ? "Wiadomości" : "Podsumowanie"} role={identity.role} />;
}
