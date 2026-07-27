// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Otwórz dialog</button>
      {open ? (
        <Dialog
          ariaLabelledby="test-dialog-title"
          className="bg-white"
          onClose={() => setOpen(false)}
        >
          <h2 id="test-dialog-title">Dostępny dialog</h2>
          <button data-dialog-initial-focus>Pierwsza akcja</button>
          <button>Ostatnia akcja</button>
        </Dialog>
      ) : null}
    </>
  );
}

describe("Dialog", () => {
  afterEach(() => {
    cleanup();
    expect(document.body.style.overflow).toBe("");
  });

  it("blokuje tło, przenosi i zapętla fokus, a Escape oddaje go wyzwalaczowi", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Otwórz dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Pierwsza akcja" })).toHaveFocus();

    screen.getByRole("button", { name: "Ostatnia akcja" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Pierwsza akcja" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("nie zamyka zablokowanego dialogu Escape ani kliknięciem tła", () => {
    const close = vi.fn();
    render(
      <Dialog
        ariaLabel="Zapisywanie"
        className="bg-white"
        closeDisabled
        onClose={close}
      >
        <button>Zapisuję</button>
      </Dialog>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.querySelector("[data-dialog-overlay]")!);
    expect(close).not.toHaveBeenCalled();
  });
});
