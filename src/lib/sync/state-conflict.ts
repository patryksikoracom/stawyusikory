import type { AppData } from "@/lib/types";

export type SyncConflictSource = "server-rejection" | "another-tab";

export type SyncChangeSummary = {
  key: keyof AppData;
  label: string;
  localChanges: number;
  remoteChanges?: number;
};

export type SyncConflict = {
  source: SyncConflictSource;
  detectedAt: string;
  expectedVersion: number;
  currentVersion?: number;
  requestId?: string;
  remoteSavedAt?: string;
  changes: SyncChangeSummary[];
};

const sections: { key: keyof AppData; label: string }[] = [
  { key: "bookings", label: "Rezerwacje" },
  { key: "payments", label: "Płatności" },
  { key: "tasks", label: "Zadania" },
  { key: "checklistItems", label: "Checklisty" },
  { key: "blocks", label: "Blokady kalendarza" },
  { key: "guests", label: "Profile gości" },
  { key: "consents", label: "Kontakty i zgody" },
  { key: "issues", label: "Usterki" },
  { key: "messages", label: "Wiadomości" },
  { key: "scheduledMessages", label: "Zaplanowane wiadomości" },
  { key: "departureDebriefs", label: "Podsumowania wyjazdu" },
  { key: "units", label: "Domki" },
  { key: "rates", label: "Cennik" },
  { key: "costSettings", label: "Założenia kosztowe" },
  { key: "sourceConnections", label: "Integracje" },
  { key: "settings", label: "Ustawienia" },
  { key: "auditLog", label: "Lokalny audyt" },
];

function recordId(value: unknown, index: number) {
  if (!value || typeof value !== "object") return `index:${index}`;
  const record = value as Record<string, unknown>;
  return String(record.id ?? record.bookingId ?? `index:${index}`);
}

function changedRecords(base: unknown, candidate: unknown) {
  if (!Array.isArray(base) || !Array.isArray(candidate)) {
    return JSON.stringify(base) === JSON.stringify(candidate) ? 0 : 1;
  }
  const baseById = new Map(base.map((item, index) => [recordId(item, index), JSON.stringify(item)]));
  const candidateById = new Map(candidate.map((item, index) => [recordId(item, index), JSON.stringify(item)]));
  const ids = new Set([...baseById.keys(), ...candidateById.keys()]);
  let changed = 0;
  for (const id of ids) {
    if (baseById.get(id) !== candidateById.get(id)) changed += 1;
  }
  return changed;
}

export function summarizeSyncChanges(base: AppData, local: AppData, remote?: AppData): SyncChangeSummary[] {
  return sections.flatMap(({ key, label }) => {
    const localChanges = changedRecords(base[key], local[key]);
    const remoteChanges = remote ? changedRecords(base[key], remote[key]) : undefined;
    if (localChanges === 0 && (remoteChanges ?? 0) === 0) return [];
    return [{ key, label, localChanges, remoteChanges }];
  });
}

export function conflictBackup(data: AppData, conflict: SyncConflict) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    reason: "Niezapisane zmiany po konflikcie synchronizacji",
    conflict: {
      source: conflict.source,
      detectedAt: conflict.detectedAt,
      expectedVersion: conflict.expectedVersion,
      currentVersion: conflict.currentVersion,
      requestId: conflict.requestId,
    },
    data,
  }, null, 2);
}
