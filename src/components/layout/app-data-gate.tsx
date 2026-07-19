import type { ReactNode } from "react";
import type { DataStatus } from "./app-store";
import { Icon } from "@/components/ui/icons";
import { Button, Card } from "@/components/ui/primitives";

export function AppDataGate({
  children,
  onRetry,
  status,
}: {
  children: ReactNode;
  onRetry: () => void;
  status: DataStatus;
}) {
  if (status === "ready") return children;

  if (status === "error") {
    return (
      <Card className="mx-auto mt-10 max-w-xl p-7 text-center" role="alert">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f9dfd7] text-[#9b4029]">
          <Icon className="size-5" name="warning" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-.03em]">Nie udało się pobrać danych</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#61716a]">
          Nie pokazujemy pustych ani przykładowych wartości. Sprawdź połączenie i spróbuj ponownie.
        </p>
        <Button className="mt-5" onClick={onRetry}>
          <Icon className="size-4" name="refresh" />
          Pobierz dane ponownie
        </Button>
      </Card>
    );
  }

  return (
    <section aria-busy="true" aria-label="Ładowanie danych aplikacji" className="animate-pulse" role="status">
      <span className="sr-only">Pobieramy aktualne dane organizacji.</span>
      <div className="mb-7 grid gap-3">
        <div className="h-3 w-32 rounded-full bg-[#dfe3d4]" />
        <div className="h-10 w-64 max-w-[75vw] rounded-2xl bg-[#d9ded1]" />
        <div className="h-4 w-full max-w-xl rounded-full bg-[#e4e1d8]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="h-28 rounded-[18px] border border-[#ddd7ca] bg-[#faf7f0]" key={item} />
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-72 rounded-[18px] border border-[#ddd7ca] bg-[#faf7f0]" />
        <div className="h-56 rounded-[18px] border border-[#ddd7ca] bg-[#faf7f0]" />
      </div>
    </section>
  );
}
