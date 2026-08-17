import { describe, expect, it } from "vitest";
import type {
  Booking,
  CostSetting,
  PaymentTransaction,
  PlatformImport,
  Unit,
} from "@/lib/types";
import { calculateManagementResult } from "./management-result";

const period = { from: "2026-01-01", toExclusive: "2027-01-01" };

const unit = (overrides: Partial<Unit> = {}): Unit => ({
  id: "u1",
  name: "Rybak",
  maxPeople: 4,
  bedrooms: 2,
  defaultPricePerNight: 500,
  defaultCleaningCost: 0,
  notes: "",
  ...overrides,
});

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "B-1",
  bookingDate: "2026-01-01",
  source: "Telefon",
  platform: "Bezpośrednio",
  unitId: "u1",
  checkIn: "2026-02-01",
  checkOut: "2026-02-03",
  adults: 2,
  children: 0,
  guestLabel: "Gość testowy",
  grossPrice: 1_000,
  currency: "PLN",
  paymentStatus: "Opłacone",
  workflowStatus: "Zamknięta",
  createdBy: "test",
  ...overrides,
});

const payment = (overrides: Partial<PaymentTransaction> = {}): PaymentTransaction => ({
  id: "PAY-1",
  bookingId: "B-1",
  occurredAt: "2026-02-04",
  type: "Koszt",
  amount: 250,
  currency: "PLN",
  status: "Zaksięgowana",
  source: "Faktura",
  sourceRef: "FV/1/2026",
  costCategory: "Energia",
  unitId: "u1",
  ...overrides,
});

const cost = (overrides: Partial<CostSetting> = {}): CostSetting => ({
  id: "COST-ENERGY",
  label: "Energia",
  value: 200,
  unit: "miesiąc",
  active: true,
  kind: "operating",
  category: "Energia",
  currency: "PLN",
  source: "Umowa z dostawcą",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  unitId: "u1",
  ...overrides,
});

const importedCommission = (overrides: Partial<PlatformImport> = {}): PlatformImport => ({
  id: "IMPORT-1",
  platform: "Booking",
  commission: 150,
  matchedBookingId: "B-1",
  reservationNo: "BOOK-123",
  transferStatus: "Przeniesione",
  ...overrides,
});

describe("management result engine", () => {
  it("uses an actual linked cost instead of duplicating its model", () => {
    const result = calculateManagementResult({
      bookings: [booking()],
      payments: [payment({ costSettingId: "COST-ENERGY" })],
      costSettings: [cost()],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0]).toMatchObject({
      currency: "PLN",
      sales: 1_000,
      actualCosts: 250,
      modeledCosts: 0,
      totalCosts: 250,
      result: 750,
      completeness: "complete",
    });
    expect(result.issues.map((item) => item.code)).not.toContain("duplicate_cost_risk");
  });

  it("gives an imported commission precedence over a percentage model", () => {
    const result = calculateManagementResult({
      bookings: [booking({ platform: "Booking" })],
      payments: [payment({ amount: 100 })],
      costSettings: [cost({
        id: "BOOKING-RULE",
        label: "Prowizja Booking",
        value: 20,
        unit: "% przychodu",
        kind: "commission",
        category: "Prowizja OTA",
        platform: "Booking",
      })],
      imports: [importedCommission()],
      units: [unit()],
      period,
    });

    expect(result.currencies[0]).toMatchObject({
      sales: 1_000,
      actualCosts: 100,
      actualCommissions: 150,
      modeledCommissions: 0,
      totalCosts: 250,
      result: 750,
    });
    expect(result.lines.find((line) => line.category === "Prowizja OTA")).toMatchObject({
      kind: "actual",
      source: "Import Booking",
      sourceRef: "BOOK-123",
    });
  });

  it("counts a Booking payment-processing fee as a separate actual OTA cost", () => {
    const result = calculateManagementResult({
      bookings: [booking({ platform: "Booking" })],
      payments: [payment({ amount: 100 })],
      costSettings: [],
      imports: [importedCommission({
        commission: 150,
        paymentProcessingFee: 25,
        sourceFile: "booking-payout.csv",
        payoutReference: "PAYOUT-1",
      })],
      units: [unit()],
      period,
    });

    expect(result.currencies[0]).toMatchObject({
      actualCommissions: 175,
      totalCosts: 275,
      result: 725,
    });
    expect(result.lines.filter((line) => line.category === "Prowizja OTA")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Prowizja Booking", amount: 150 }),
        expect.objectContaining({ label: "Opłata za obsługę płatności Booking", amount: 25 }),
      ]),
    );
  });

  it("keeps a negative management result visible", () => {
    const result = calculateManagementResult({
      bookings: [booking({ grossPrice: 100 })],
      payments: [payment({ amount: 150 })],
      costSettings: [],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0].result).toBe(-50);
    expect(result.currencies[0].completeness).toBe("complete");
  });

  it("shows a loss in a month with costs and no sales", () => {
    const result = calculateManagementResult({
      bookings: [],
      payments: [payment({ bookingId: "OUTSIDE-PERIOD", amount: 150 })],
      costSettings: [],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0]).toMatchObject({
      sales: 0,
      actualCosts: 150,
      result: -150,
      completeness: "complete",
    });
  });

  it("does not require commission evidence for a direct booking", () => {
    const result = calculateManagementResult({
      bookings: [booking()],
      payments: [payment()],
      costSettings: [],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.issues.map((item) => item.code)).not.toContain("ota_commission_missing");
    expect(result.currencies[0].result).toBe(750);
  });

  it("refuses to present sales as profit when operating costs are missing", () => {
    const result = calculateManagementResult({
      bookings: [booking()],
      payments: [],
      costSettings: [],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0].result).toBeNull();
    expect(result.currencies[0].completeness).toBe("unavailable");
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "missing_cost_inputs",
      blocking: true,
    }));
    expect(result.readiness.questions).toContain(
      "Jakie koszty ponosimy niezależnie od pobytów i jakie za każdy pobyt (sprzątanie, energia, woda, szambo, serwis, podatki)?",
    );
  });

  it("keeps currencies separate", () => {
    const result = calculateManagementResult({
      bookings: [
        booking(),
        booking({ id: "EUR-1", currency: "EUR", grossPrice: 400, unitId: "u2" }),
      ],
      payments: [
        payment(),
        payment({
          id: "EUR-COST",
          bookingId: "EUR-1",
          currency: "EUR",
          amount: 100,
          unitId: "u2",
        }),
      ],
      costSettings: [],
      imports: [],
      units: [unit(), unit({ id: "u2", name: "Łabędź" })],
      period,
    });

    expect(result.currencies).toEqual([
      expect.objectContaining({ currency: "PLN", sales: 1_000, result: 750 }),
      expect.objectContaining({ currency: "EUR", sales: 400, result: 300 }),
    ]);
  });

  it("keeps a EUR model issue out of PLN completeness", () => {
    const result = calculateManagementResult({
      bookings: [
        booking(),
        booking({ id: "EUR-1", currency: "EUR", grossPrice: 400, unitId: "u2" }),
      ],
      payments: [
        payment(),
        payment({ id: "EUR-COST", bookingId: "EUR-1", currency: "EUR", amount: 100, unitId: "u2" }),
      ],
      costSettings: [cost({
        id: "EUR-WATER",
        label: "Woda EUR",
        category: "Woda",
        currency: "EUR",
        source: undefined,
        unitId: "u2",
      })],
      imports: [],
      units: [unit(), unit({ id: "u2", name: "Łabędź" })],
      period,
    });

    expect(result.currencies.find((item) => item.currency === "PLN")?.completeness).toBe("complete");
    expect(result.currencies.find((item) => item.currency === "EUR")?.completeness).toBe("partial");
  });

  it("blocks all reported currencies when a booking has no currency", () => {
    const result = calculateManagementResult({
      bookings: [booking(), booking({ id: "NO-CURRENCY", currency: undefined })],
      payments: [payment()],
      costSettings: [],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0].result).toBeNull();
    expect(result.currencies[0].completeness).toBe("unavailable");
  });

  it("allocates a shared model by revenue between units", () => {
    const result = calculateManagementResult({
      bookings: [
        booking({ grossPrice: 750 }),
        booking({ id: "B-2", unitId: "u2", grossPrice: 250 }),
      ],
      payments: [],
      costSettings: [cost({
        id: "SHARED",
        label: "Wspólny serwis",
        value: 100,
        unit: "rok",
        unitId: undefined,
        allocation: "revenue",
      })],
      imports: [],
      units: [unit(), unit({ id: "u2", name: "Łabędź" })],
      period,
    });

    expect(result.units).toEqual([
      expect.objectContaining({ unitId: "u1", costs: 75, result: 675 }),
      expect.objectContaining({ unitId: "u2", costs: 25, result: 225 }),
    ]);
    expect(result.readiness.checks.find((check) => check.id === "allocation")?.ready).toBe(true);
  });

  it("applies a model only during its validity period", () => {
    const result = calculateManagementResult({
      bookings: [booking({ checkIn: "2026-07-10", checkOut: "2026-07-12" })],
      payments: [],
      costSettings: [cost({
        value: 1_200,
        unit: "rok",
        dateFrom: "2026-07-01",
        dateTo: "2026-12-31",
      })],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0]).toMatchObject({
      modeledCosts: 600,
      result: 400,
      completeness: "complete",
    });
  });

  it("blocks an ambiguous actual and modeled cost instead of double counting silently", () => {
    const result = calculateManagementResult({
      bookings: [booking()],
      payments: [payment()],
      costSettings: [cost()],
      imports: [],
      units: [unit()],
      period,
    });

    expect(result.currencies[0].result).toBeNull();
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "duplicate_cost_risk",
      blocking: true,
    }));
  });
});
