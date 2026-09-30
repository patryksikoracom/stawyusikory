// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import { defaultMessageTemplates } from "@/lib/workflow/communications";
import { MessagesView } from "./messages-view";
const mocks = vi.hoisted(() => ({ save: vi.fn(), mode: "templates" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ view: mocks.mode }) }));
vi.mock("@/components/layout/app-store", () => ({ useAppStore: () => ({
  data: { ...initialData, messageTemplates: defaultMessageTemplates.filter(item => item.id === "TPL-CONFIRM"), communicationConfigs: [{ id: "communication", senderName: "Stawy", copyUserIds: [], travelGuides: [], version: 8 }] },
  upsertCommunicationConfig: mocks.save,
}) }));
afterEach(cleanup);
beforeEach(() => { mocks.mode = "templates"; mocks.save.mockReset(); });
describe("template editor", () => {
  it("reports failed persistence and keeps the user's draft open", async () => {
    mocks.save.mockResolvedValue({ ok: false, message: "Konflikt wersji" });
    render(<MessagesView canEdit/>);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Treść wiadomości" }), { target: { value: "Witaj {{guest_first_name}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz szablon" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Konflikt wersji");
    expect(screen.getByRole("textbox", { name: "Treść wiadomości" })).toHaveValue("Witaj {{guest_first_name}}");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ version: 8, templateOverrides: [expect.objectContaining({ id: "TPL-CONFIRM", version: 4, body: "Witaj {{guest_first_name}}" })] }));
  });
  it("does not allow unknown placeholders or editing from a read-only role", async () => {
    const { unmount } = render(<MessagesView canEdit/>);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Treść wiadomości" }), { target: { value: "Witaj {{not_supported}}" } });
    expect(screen.getByRole("button", { name: "Zapisz szablon" })).toBeDisabled();
    unmount();
    render(<MessagesView canEdit={false}/>);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz/ }));
    expect(screen.getByRole("textbox", { name: "Treść wiadomości" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Zapisz szablon" })).not.toBeInTheDocument();
  });
  it("closes only after confirmed save", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    render(<MessagesView canEdit/>);
    fireEvent.click(screen.getByRole("button", { name: /Otwórz/ }));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz szablon" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
