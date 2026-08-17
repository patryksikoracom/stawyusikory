import type { AppData, ContactConsent, GuestPerson, GuestProfile } from "@/lib/types";

export type DuplicateReason = "phone" | "email";

export type DuplicateCandidate = {
  person: GuestPerson;
  reasons: DuplicateReason[];
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeGuestPhone(value?: string) {
  if (!value?.trim()) return undefined;
  const normalized = digits(value);
  if (normalized.length < 9 || normalized.length > 15) return undefined;
  if (normalized.length === 9) return `+48${normalized}`;
  if (normalized.startsWith("48") && normalized.length === 11) return `+${normalized}`;
  return value.trim().startsWith("+") ? `+${normalized}` : normalized;
}

export function normalizeGuestEmail(value?: string) {
  const normalized = value?.trim().toLocaleLowerCase("pl-PL");
  if (!normalized || !normalized.includes("@")) return undefined;
  return normalized;
}

export function guestPersonId(bookingId: string) {
  return `PERSON-${bookingId}`;
}

export function ensureGuestPeople(data: AppData): AppData {
  const existing = new Map(data.people.map((person) => [person.id, person]));
  const bookingsById = new Map(data.bookings.map((booking) => [booking.id, booking]));
  const contactsByBooking = new Map(data.consents.map((contact) => [contact.bookingId, contact]));
  const people = [...data.people];
  const guests = data.guests.map((current) => {
    const booking = bookingsById.get(current.bookingId);
    if (!booking) return current;
    if (current.personId && existing.has(current.personId)) return current;
    const id = current.personId ?? guestPersonId(current.bookingId);
    if (!existing.has(id)) {
      const contact = contactsByBooking.get(current.bookingId);
      const person: GuestPerson = {
        id,
        displayName: booking.guestLabel,
        phone: normalizeGuestPhone(contact?.phone),
        email: normalizeGuestEmail(contact?.email),
        createdAt: booking.updatedAt ?? `${booking.checkIn}T00:00:00.000Z`,
        createdBy: booking.createdBy || "Migracja danych",
      };
      existing.set(id, person);
      people.push(person);
    }
    return { ...current, personId: id };
  });
  return { ...data, people, guests };
}

export function duplicateCandidates(
  people: GuestPerson[],
  contact: Pick<ContactConsent, "phone" | "email">,
  excludedPersonId?: string,
): DuplicateCandidate[] {
  const phone = normalizeGuestPhone(contact.phone);
  const email = normalizeGuestEmail(contact.email);
  if (!phone && !email) return [];
  return people.flatMap((person) => {
    if (person.id === excludedPersonId) return [];
    const reasons: DuplicateReason[] = [];
    if (phone && normalizeGuestPhone(person.phone) === phone) reasons.push("phone");
    if (email && normalizeGuestEmail(person.email) === email) reasons.push("email");
    return reasons.length ? [{ person, reasons }] : [];
  });
}

export function mergeGuestPeople(
  data: AppData,
  sourcePersonId: string,
  targetPersonId: string,
): AppData {
  if (sourcePersonId === targetPersonId) return data;
  const source = data.people.find((person) => person.id === sourcePersonId);
  const target = data.people.find((person) => person.id === targetPersonId);
  if (!source || !target) return data;
  return {
    ...data,
    people: data.people
      .filter((person) => person.id !== sourcePersonId)
      .map((person) => person.id === targetPersonId ? {
        ...person,
        phone: person.phone ?? source.phone,
        email: person.email ?? source.email,
      } : person),
    guests: data.guests.map((profile) => (
      profile.personId === sourcePersonId ? { ...profile, personId: targetPersonId } : profile
    )),
  };
}

export function staysForPerson(guests: GuestProfile[], personId: string) {
  return guests.filter((profile) => profile.personId === personId).map((profile) => profile.bookingId);
}
