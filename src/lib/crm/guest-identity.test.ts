import { describe, expect, it } from "vitest";
import { initialData } from "@/lib/demo-data";
import {
  duplicateCandidates,
  ensureGuestPeople,
  mergeGuestPeople,
  normalizeGuestPhone,
  staysForPerson,
} from "./guest-identity";

describe("guest identity", () => {
  it("migrates legacy stays one-to-one without guessing duplicates", () => {
    const normalized = ensureGuestPeople({ ...initialData, people: [] });
    expect(normalized.people).toHaveLength(normalized.guests.length);
    expect(normalized.guests.every((profile) => profile.personId)).toBe(true);
  });

  it("normalizes Polish phone formats and suggests exact contact matches", () => {
    expect(normalizeGuestPhone("501 234 567")).toBe("+48501234567");
    const candidates = duplicateCandidates(
      [{ id: "P-1", displayName: "Anna", phone: "+48 501 234 567", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "owner" }],
      { phone: "501234567", email: "other@example.com" },
    );
    expect(candidates).toEqual([
      expect.objectContaining({ person: expect.objectContaining({ id: "P-1" }), reasons: ["phone"] }),
    ]);
  });

  it("never suggests a merge from a name alone", () => {
    expect(duplicateCandidates(
      [{ id: "P-1", displayName: "Jan Kowalski", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "owner" }],
      {},
    )).toEqual([]);
  });

  it("links stays only after an explicit merge and leaves booking consents untouched", () => {
    const data = ensureGuestPeople({
      ...initialData,
      people: [],
      bookings: initialData.bookings.slice(0, 2),
      guests: initialData.guests.slice(0, 2),
      consents: initialData.consents.slice(0, 2),
    });
    const [source, target] = data.people;
    const merged = mergeGuestPeople(data, source.id, target.id);
    expect(staysForPerson(merged.guests, target.id)).toHaveLength(2);
    expect(merged.people).toHaveLength(1);
    expect(merged.consents).toEqual(data.consents);
  });
});
