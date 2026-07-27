"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type RefObject,
  type ReactNode,
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let bodyLockDepth = 0;
let bodyOverflowBeforeLock = "";
const dialogStack: HTMLElement[] = [];

function lockBodyScroll() {
  if (bodyLockDepth === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyLockDepth += 1;
}

function unlockBodyScroll() {
  bodyLockDepth = Math.max(0, bodyLockDepth - 1);
  if (bodyLockDepth === 0) {
    document.body.style.overflow = bodyOverflowBeforeLock;
  }
}

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export function Dialog({
  children,
  onClose,
  closeDisabled = false,
  closeOnBackdrop = true,
  returnFocusRef,
  role = "dialog",
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  overlayClassName = "",
  className = "",
  ...surfaceProps
}: {
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  overlayClassName?: string;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "role">) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(() => onClose());
  const closingIsDisabled = useEffectEvent(() => closeDisabled);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const returnFocusElement = returnFocusRef?.current ?? (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);

    dialogStack.push(dialog);
    lockBodyScroll();

    const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")
      ?? dialog.querySelector<HTMLElement>("[autofocus]")
      ?? focusableElements(dialog)[0]
      ?? dialog;
    initialFocus.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (dialogStack.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        if (closingIsDisabled()) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const stackIndex = dialogStack.lastIndexOf(dialog);
      if (stackIndex >= 0) dialogStack.splice(stackIndex, 1);
      unlockBodyScroll();
      if (returnFocusElement?.isConnected) returnFocusElement.focus();
    };
  }, [returnFocusRef]);

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (
      closeOnBackdrop
      && !closeDisabled
      && event.target === event.currentTarget
      && dialogStack.at(-1) === dialogRef.current
    ) {
      onClose();
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#102c24]/70 p-4 backdrop-blur-sm ${overlayClassName}`}
      data-dialog-overlay
      onMouseDown={onBackdropMouseDown}
    >
      <div
        {...surfaceProps}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-modal="true"
        className={className}
        ref={dialogRef}
        role={role}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
