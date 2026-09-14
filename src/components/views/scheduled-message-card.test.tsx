// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ScheduledMessageCard } from "./bookings-view";
afterEach(cleanup);
it("keeps an edited message open until its save is confirmed", async () => {
  const save = vi.fn().mockResolvedValueOnce({ ok: false, message: "Nie zapisano" }).mockResolvedValueOnce({ ok: true });
  render(<ScheduledMessageCard templateName="Test" onChange={save} message={{ id: "message", bookingId: "booking", ruleId: "rule", templateId: "template", templateVersion: 1, channel: "E-mail", recipient: "test@example.com", dueAt: "2099-01-01T10:00:00", renderedBody: "Original", status: "Wersja robocza", bookingFingerprint: "test", idempotencyKey: "test", createdAt: "2099-01-01" }}/>);
  fireEvent.click(screen.getByText("Edytuj"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Edited" } });
  fireEvent.click(screen.getByText("Zapisz szkic"));
  expect((await screen.findByRole("alert")).textContent).toContain("Nie zapisano");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Edited");
  fireEvent.click(screen.getByText("Zapisz szkic"));
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ renderedBody: "Edited", status: "Wersja robocza" }));
});
