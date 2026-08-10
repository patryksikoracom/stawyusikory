import { describe, expect, it } from "vitest";
import type { SourceConnection } from "@/lib/types";
import {
  configuredIcalConnections,
  connectionForSlot,
  draftConnectionForSlot,
} from "./ical-connections";

const placeholder: SourceConnection = {
  id: "SRC-AIRBNB",
  platform: "Airbnb",
  connectionType: "iCal",
  status: "Do podłączenia",
  coverage: 0,
  nextStep: "Skonfiguruj",
  notes: "test",
  priority: "Teraz",
};

describe("macierz połączeń iCal", () => {
  it("liczy wyłącznie kompletne feedy", () => {
    const configured = {
      ...placeholder,
      id: "SRC-BOOKING-RYBAK",
      platform: "Booking" as const,
      unitId: "rybak",
      importUrl: "https://example.com/rybak.ics",
    };
    expect(configuredIcalConnections([placeholder, configured])).toEqual([configured]);
  });

  it("odnajduje dokładną parę portal–domek i wykorzystuje pusty slot", () => {
    const draft = draftConnectionForSlot([placeholder], "Airbnb", { id: "czapla", name: "Czapla" });
    expect(draft).toMatchObject({ id: "SRC-AIRBNB", platform: "Airbnb", unitId: "czapla" });
    expect(connectionForSlot([draft], "Airbnb", "czapla")).toEqual(draft);
  });

  it("tworzy stabilny identyfikator, gdy nie ma pustego slotu", () => {
    expect(draftConnectionForSlot([], "Booking", { id: "czapla", name: "Czapla" })).toMatchObject({
      id: "SRC-BOOKING-czapla",
      unitId: "czapla",
    });
  });
});
