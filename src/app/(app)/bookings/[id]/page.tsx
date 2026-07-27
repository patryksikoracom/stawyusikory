import { BookingsView } from "@/components/views/bookings-view";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <BookingsView initialId={decodeURIComponent(id)} initialTab={tab === "messages" ? "Wiadomości" : "Podsumowanie"} />;
}
