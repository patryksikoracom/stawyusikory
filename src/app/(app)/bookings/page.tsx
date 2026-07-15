import { BookingsView } from "@/components/views/bookings-view";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <BookingsView initialView={view === "sheet" ? "sheet" : "list"} />;
}
