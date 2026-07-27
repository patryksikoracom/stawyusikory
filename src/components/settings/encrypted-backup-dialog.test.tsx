// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EncryptedBackupDialog } from "./encrypted-backup-dialog";

describe("EncryptedBackupDialog", () => {
  afterEach(cleanup);

  it("waliduje oba hasła przed uruchomieniem eksportu", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<EncryptedBackupDialog onClose={onClose} onExport={onExport}/>);

    fireEvent.change(screen.getByLabelText("Hasło"), { target: { value: "bardzo-dlugie-haslo" } });
    fireEvent.change(screen.getByLabelText("Powtórz hasło"), { target: { value: "inne-bardzo-dlugie" } });
    fireEvent.click(screen.getByRole("button", { name: "Pobierz zaszyfrowany plik" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Powtórzone hasło nie jest identyczne.");
    expect(onExport).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Powtórz hasło"), { target: { value: "bardzo-dlugie-haslo" } });
    fireEvent.click(screen.getByRole("button", { name: "Pobierz zaszyfrowany plik" }));

    expect(onExport).toHaveBeenCalledWith("bardzo-dlugie-haslo");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
