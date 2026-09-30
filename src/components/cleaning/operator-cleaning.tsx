"use client";

import { useState } from "react";
import { useAppStore } from "@/components/layout/app-store";
import { Button, Card, Field, inputClass } from "@/components/ui/primitives";
import { formatPolishDate } from "@/lib/date";
import { cleaningSettlementSummary } from "@/lib/cleaning/settlements";
import type { OpsTask } from "@/lib/types";

export function OperatorCleaning() {
  const { data, updateTask, syncMode } = useAppStore();
  const [showPaid, setShowPaid] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const activeBookings = new Set(data.bookings.filter(booking => !booking.deletedAt && booking.workflowStatus !== "Anulowana").map(booking => booking.id));
  const tasks = data.tasks.filter(task => task.type === "Sprzątanie" && task.status !== "Nie dotyczy"
    && (activeBookings.has(task.bookingId) || task.status === "Zrobione"));
  const visibleTasks = tasks.filter(task => showPaid || !task.cleaningSettlement?.paidAt || task.status !== "Zrobione");
  const summary = cleaningSettlementSummary(tasks);
  const payable = tasks.filter(task => selected.includes(task.id) && task.status === "Zrobione" && task.cleaningSettlement && !task.cleaningSettlement.paidAt);
  const selectedAmount = cleaningSettlementSummary(payable).unpaidAmount;
  const disabled = syncMode === "checking" || syncMode === "error" || syncMode === "conflict";
  return <div className="grid gap-4">
    <Card className="p-5">
      <h2 className="text-xl font-bold">Sprzątanie i rozliczenie z Jadzią</h2>
      <p className="mt-2 text-3xl font-bold">{summary.unpaidAmount.toLocaleString("pl-PL")} zł <span className="text-base font-normal">do zapłaty za wykonane sprzątania</span></p>
      {summary.missingAmountCount > 0 ? <p className="mt-2 text-amber-800">Sprzątania bez wpisanej kwoty: {summary.missingAmountCount}.</p> : null}
      <p className="mt-2 text-sm text-[#65736d]">Należność dla osoby sprzątającej. Płatność gościa sprawdzisz w rezerwacji.</p>
    </Card>
    {disabled ? <p role="alert">Zapis jest niedostępny. Sprawdź synchronizację u góry ekranu.</p> : null}
    <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={showPaid} onChange={event => setShowPaid(event.target.checked)} />Pokaż również rozliczone</label>
    {payable.length ? <Card className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="font-bold">Wybrane sprzątania: {payable.length} · {selectedAmount.toLocaleString("pl-PL")} zł</p>
      <Button disabled={disabled} onClick={() => {
        const paidAt = new Date().toISOString();
        payable.forEach(task => updateTask({ ...task, cleaningSettlement: { ...task.cleaningSettlement!, paidAt } }));
        setSelected([]);
      }}>Oznacz zaznaczone jako zapłacone</Button>
    </Card> : null}
    {visibleTasks
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .map(task => <CleaningRow key={`${task.id}-${task.version ?? 0}`} task={task} disabled={disabled}
        unit={data.units.find(unit => unit.id === task.unitId)?.name ?? "Domek"}
        guest={data.bookings.find(booking => booking.id === task.bookingId)?.guestLabel}
        selected={selected.includes(task.id)} onSelect={checked => setSelected(current => checked ? [...current, task.id] : current.filter(id => id !== task.id))}
        onChange={updateTask} />)}
    {!visibleTasks.length ? <Card className="p-5">{tasks.length ? "Wszystkie sprzątania są rozliczone." : "Brak zadań sprzątania."}</Card> : null}
  </div>;
}

function CleaningRow({ task, unit, guest, disabled, onChange, selected, onSelect }: {
  task: OpsTask; unit: string; guest?: string; disabled: boolean; onChange: (task: OpsTask) => void;
  selected: boolean; onSelect: (checked: boolean) => void;
}) {
  const [amount, setAmount] = useState(task.cleaningSettlement?.amount.toString() ?? "");
  const parsedAmount = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount >= 0 && parsedAmount <= 100_000 && Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) < 0.00001;
  const paid = Boolean(task.cleaningSettlement?.paidAt);
  const complete = task.status === "Zrobione";
  return <Card className="grid gap-4 p-5">
    <div><h3 className="text-xl font-bold">{unit}</h3><p>{formatPolishDate(task.dueDate)}{guest ? ` · po pobycie: ${guest}` : ""}</p></div>
    {complete && task.cleaningSettlement && !paid ? <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={selected} disabled={disabled} onChange={event => onSelect(event.target.checked)} />Zaznacz do wspólnego rozliczenia</label> : null}
    {task.blocker ? <p role="alert" className="text-red-800">{task.blocker}</p> : null}
    <div className="flex flex-wrap items-center gap-3">
      {complete ? <p className="font-bold text-green-800">✓ Posprzątane</p> : <Button disabled={disabled || task.status === "Zablokowane"} onClick={() => {
        const now = new Date().toISOString();
        onChange({ ...task, status: "Zrobione", completedAt: now, readyAt: now,
          readinessEvidence: { source: "operator-confirmation", completedItems: 0, totalItems: 0 } });
      }}>Potwierdzam: posprzątane</Button>}
      <span>{paid ? `Zapłacone ${formatPolishDate(task.cleaningSettlement!.paidAt)}` : "Nierozliczone"}</span>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Kwota za sprzątanie (zł)"><input className={inputClass} inputMode="decimal" value={amount} disabled={disabled || paid} onChange={event => setAmount(event.target.value)} /></Field>
      <Button variant="secondary" disabled={disabled || paid || !valid || parsedAmount === task.cleaningSettlement?.amount}
        onClick={() => onChange({ ...task, cleaningSettlement: { amount: parsedAmount, currency: "PLN" } })}>Zapisz kwotę</Button>
      {!paid ? <Button disabled={disabled || !complete || !task.cleaningSettlement}
        onClick={() => onChange({ ...task, cleaningSettlement: { ...task.cleaningSettlement!, paidAt: new Date().toISOString() } })}>Zapłacone</Button>
        : <Button variant="secondary" disabled={disabled} onClick={() => onChange({ ...task, cleaningSettlement: { amount: task.cleaningSettlement!.amount, currency: "PLN" } })}>Cofnij oznaczenie płatności</Button>}
    </div>
  </Card>;
}
