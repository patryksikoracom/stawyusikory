// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
const mocks = vi.hoisted(() => ({ addMessage: vi.fn(), updateReviewRequest: vi.fn() }));
vi.mock("@/components/layout/app-store", () => ({ useAppStore: () => ({ data: { messages: [], scheduledMessages: [], reviewRequests: [], messageTemplates: [] }, ...mocks }) }));
import { Messages } from "./bookings-view";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("preserves a failed note and retries the same record ID", async () => {
  mocks.addMessage.mockResolvedValueOnce({ ok: false, message: "Zapis odrzucony" }).mockResolvedValueOnce({ ok: true });
  render(<Messages booking={initialData.bookings[0]}/>);
  const input = screen.getByPlaceholderText("Wewnętrzna notatka…") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Gość przyjedzie później" } });
  fireEvent.click(screen.getByLabelText("Zapisz notatkę"));
  expect((await screen.findByRole("alert")).textContent).toContain("Zapis odrzucony");
  expect(input.value).toBe("Gość przyjedzie później");
  fireEvent.click(screen.getByLabelText("Zapisz notatkę"));
  await waitFor(() => expect(input.value).toBe(""));
  expect(mocks.addMessage.mock.calls[0][0].id).toBe(mocks.addMessage.mock.calls[1][0].id);
});
it("shows an unsuccessful review status save", async () => {
  mocks.updateReviewRequest.mockResolvedValue({ ok: false, message: "Nie zmieniono statusu" });
  render(<Messages booking={initialData.bookings[0]}/>);
  fireEvent.change(screen.getByLabelText("Status opinii publicznej"), { target: { value: "received" } });
  expect((await screen.findByRole("alert")).textContent).toContain("Nie zmieniono statusu");
});
