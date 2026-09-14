"use client";
import { useRef, useState } from "react";

type Result = boolean | { ok: boolean; message?: string };

export function useConfirmedAction() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<Result>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action();
      const ok = typeof result === "boolean" ? result : result.ok;
      if (!ok) {
        setError(typeof result === "object" && result.message
          ? result.message : "Nie potwierdzono zapisu. Sprawdź synchronizację i odśwież dane przed ponowieniem.");
      }
      return ok;
    } catch {
      setError("Nie udało się potwierdzić zapisu. Sprawdź synchronizację przed ponowieniem.");
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return { pending, error, run };
}
