// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CleaningApp } from "./cleaning-app";
import type { AppIdentity } from "@/lib/auth/identity";

const identity: AppIdentity = { authenticated: true, displayName: "Test", email: null, initials: "T", organizationId: "test", organizationName: "Test", role: "cleaning", roleLabel: "Sprzątanie", userId: "test", availableOrganizations: [] };
const dashboard = { organizationName: "Test", defaultCheckIn: "16:00", defaultCheckOut: "11:00", jobs: [{ id: "task", unit: { id: "unit", name: "Czapla" }, status: "Do zrobienia", assignmentStatus: "Do przyjęcia", priority: "Średni", departureTime: "11:00", nextArrival: null, sameDayTurnover: false, bedsToPrepare: 2, bedrooms: 1, checklist: [] }] };
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("panel sprzątania: wiarygodny odczyt i zapis", () => {
  it("nie uznaje błędu odczytu za gotowy domek ani pusty plan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "Brak połączenia" }, false)));
    render(<CleaningApp identity={identity}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak połączenia");
    expect(screen.queryByText("Wszystko przygotowane")).not.toBeInTheDocument();
    expect(screen.queryByText("Brak otwartych zadań")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Do zrobienia · —" })).toBeInTheDocument();
  });

  it("zachowuje zgłoszenie po błędzie i zamyka je dopiero po potwierdzeniu", async () => {
    const fetch = vi.fn().mockResolvedValue(reply(dashboard));
    vi.stubGlobal("fetch", fetch);
    render(<CleaningApp identity={identity}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Zgłoś problem" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Co się stało?"), { target: { value: "Cieknie kran" } });
    fetch.mockResolvedValueOnce(reply({ error: "Zapis odrzucony" }, false));
    fireEvent.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Zapis odrzucony"));
    expect(within(dialog).getByLabelText("Co się stało?")).toHaveValue("Cieknie kran");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fetch.mockResolvedValueOnce(reply({ ok: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Wyślij zgłoszenie" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Problem zgłoszony");
  });
});
