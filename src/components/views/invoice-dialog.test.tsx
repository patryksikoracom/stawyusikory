// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InvoiceDialog } from "./finances-view";
afterEach(cleanup);
it("zachowuje dokument po błędzie i używa tego samego ID przy ponowieniu", async () => {
  const save = vi.fn().mockResolvedValueOnce({ ok: false, message: "Brak potwierdzenia zapisu" }).mockResolvedValueOnce({ ok: true });
  const close = vi.fn();
  render(<InvoiceDialog bookings={[]} onClose={close} onSave={save}/>);
  fireEvent.change(screen.getByLabelText("Kwota PLN"), { target: { value: "125.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Dodaj do rejestru" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Brak potwierdzenia");
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Kwota PLN")).toHaveValue(125.5);
  fireEvent.click(screen.getByRole("button", { name: "Dodaj do rejestru" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].id).toBe(save.mock.calls[1][0].id);
});
