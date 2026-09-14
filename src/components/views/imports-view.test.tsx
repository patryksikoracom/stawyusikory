// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportsView } from "./imports-view";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/components/layout/app-store", () => ({ useAppStore: () => ({ data: { blocks: [], units: [], bookings: [], sourceConnections: [], imports: [] }, replaceWithImportedBookings: mocks.save }) }));
vi.mock("@/components/integrations/integration-go-live-panel", () => ({ IntegrationGoLivePanel: () => null }));
const preview = { rows: [{ id: "test", guestLabel: "Test", checkIn: "2026-09-20", checkOut: "2026-09-22" }], contacts: [], imports: [], costSettings: [], errors: [], summary: { total: 1, historical: 0, active: 1, needsReview: 0, plnTotal: 0, eurTotal: 0 } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function setup() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("preview") ? preview : { feeds: [] } })));
  render(<ImportsView/>);
  fireEvent.change(screen.getByLabelText("Dane z Mobile Calendar"), { target: { value: "test CSV" } });
  fireEvent.click(screen.getByRole("button", { name: "1. Sprawdź dane" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "2. Scal 1 rekordów" })).toBeEnabled());
}
describe("potwierdzenie trwałego importu", () => {
  it("nie czyści podglądu ani nie ogłasza sukcesu podczas zapisu i po jego odrzuceniu", async () => {
    let resolve!: (value: unknown) => void;
    mocks.save.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "2. Scal 1 rekordów" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "2. Scal 1 rekordów" })).toBeDisabled();
    expect(screen.getByLabelText("Dane z Mobile Calendar")).toHaveValue("test CSV");
    await act(async () => { resolve({ ok: false, message: "Konflikt zapisu" }); });
    expect(screen.getByText("Konflikt zapisu")).toBeInTheDocument();
    expect(screen.getByLabelText("Dane z Mobile Calendar")).toHaveValue("test CSV");
    expect(screen.getByRole("button", { name: "2. Scal 1 rekordów" })).toBeEnabled();
  });
  it("czyści dane dopiero po potwierdzonym zapisie", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "2. Scal 1 rekordów" }));
    await waitFor(() => expect(screen.getByLabelText("Dane z Mobile Calendar")).toHaveValue(""));
    expect(screen.getByText(/Dodano 1 rezerwacji/)).toBeInTheDocument();
  });
});
