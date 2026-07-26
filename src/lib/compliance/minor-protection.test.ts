import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/types";
import {
  canExecuteMinorProtection,
  canManageMinorProtectionStandard,
  createMinorProtectionTask,
  deriveMinorProtectionGate,
  requiresMinorProtection,
  validateStandardReviewWindow,
} from "./minor-protection";

const booking: Booking = {
  id: "RES-1",
  unitId: "unit-1",
  guestLabel: "Gość",
  adults: 2,
  children: 1,
  checkIn: "2026-08-10",
  checkOut: "2026-08-12",
  bookingDate: "2026-07-20",
  source: "Telefon",
  platform: "Telefon",
  workflowStatus: "Potwierdzona",
  paymentStatus: "Zaliczka",
  currency: "PLN",
  createdBy: "operator",
};

const standard = {
  id: "SOP-1",
  version: "2026.1",
  approvedAt: "2026-07-20",
  effectiveFrom: "2026-07-21",
  reviewDueAt: "2028-07-20",
  fullDocumentUrl: "https://example.test/pelna",
  childFriendlyDocumentUrl: "https://example.test/skrocona",
  reviewOwner: "Właściciel",
  staffPreparationReference: "SZK-2026-01",
  publicationConfirmed: true,
  premisesDisplayConfirmed: true,
  steps: ["Potwierdź wykonanie kroku z SOP."],
  active: true,
} as const;

describe("ochrona małoletnich", () => {
  it("tworzy osobne zadanie tylko dla aktywnego pobytu z dziećmi", () => {
    expect(requiresMinorProtection(booking)).toBe(true);
    expect(createMinorProtectionTask(booking, "TASK-SOP")).toMatchObject({
      id: "TASK-SOP",
      type: "Przed przyjazdem",
      complianceKind: "minor-protection",
      dueDate: booking.checkIn,
      assigneeRole: "manager",
    });
    expect(createMinorProtectionTask({ ...booking, children: 0 }, "TASK-2")).toBeNull();
    expect(createMinorProtectionTask({ ...booking, workflowStatus: "Anulowana" }, "TASK-3")).toBeNull();
  });

  it("zamyka bramkę bez zatwierdzonego SOP i przy otwartej reakcji", () => {
    expect(deriveMinorProtectionGate(booking, null, null, null)).toBe("Brak aktywnego SOP");
    expect(deriveMinorProtectionGate(booking, standard, null, null)).toBe("Do wykonania");
    const execution = {
      bookingId: booking.id,
      required: true as const,
      performed: true as const,
      performedAt: "2026-08-10T14:00:00Z",
      performedBy: "user-1",
      standardId: standard.id,
      standardVersion: standard.version,
      outcome: "Wymaga reakcji" as const,
    };
    expect(deriveMinorProtectionGate(booking, standard, execution, {
      bookingId: booking.id,
      status: "Otwarte",
      openedAt: "2026-08-10T14:00:00Z",
    })).toBe("Wymaga reakcji");
    expect(deriveMinorProtectionGate(booking, standard, execution, {
      bookingId: booking.id,
      status: "Zamknięte",
      openedAt: "2026-08-10T14:00:00Z",
      closedAt: "2026-08-10T15:00:00Z",
    })).toBe("Wykonana");
  });

  it("nie wymaga procesu dla pobytu bez dzieci", () => {
    expect(deriveMinorProtectionGate({ ...booking, children: 0 }, null, null, null)).toBe("Nie dotyczy");
  });

  it("pilnuje przeglądu najpóźniej po dwóch latach", () => {
    expect(validateStandardReviewWindow(standard)).toBe(true);
    expect(validateStandardReviewWindow({ effectiveFrom: "2026-07-21", reviewDueAt: "2028-08-01" })).toBe(false);
    expect(validateStandardReviewWindow({ effectiveFrom: "2026-07-21", reviewDueAt: "2026-07-21" })).toBe(false);
  });

  it("rozdziela zarządzanie SOP od wykonania procedury", () => {
    expect(canManageMinorProtectionStandard("owner")).toBe(true);
    expect(canManageMinorProtectionStandard("manager")).toBe(false);
    expect(canExecuteMinorProtection("manager")).toBe(true);
    expect(canExecuteMinorProtection("cleaning")).toBe(false);
  });
});
