import { BookingsView } from "@/components/views/bookings-view";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingsView initialId={decodeURIComponent(id)} />;
}
