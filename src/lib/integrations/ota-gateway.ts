export const OTA_REQUIRED_FIELDS = [
  "reservation",
  "guest",
  "price",
  "commission",
  "payment",
  "availability_block",
  "status",
  "message",
  "webhook",
] as const;

export type OtaField = typeof OTA_REQUIRED_FIELDS[number];

export type GatewayContract = {
  provider: string;
  version: string;
  fieldCoverage: Partial<Record<OtaField, boolean>>;
  channels: string[];
  unitIds: string[];
  signedAt?: string;
  rtoMinutes?: number;
  rpoMinutes?: number;
};

export type OtaSnapshot = {
  externalId: string;
  unitId: string;
  channel: string;
  checkIn: string;
  checkOut: string;
  status: string;
  grossPrice?: number;
  currency?: string;
  updatedAt: string;
};

export type ShadowDifference = {
  key: string;
  externalId: string;
  field: keyof OtaSnapshot | "missing";
  sourceValue?: unknown;
  gatewayValue?: unknown;
};

export type DailyShadowReport = {
  date: string;
  differences: ShadowDifference[];
  unresolved: number;
  compared: number;
};

export function compareOtaSnapshots(source: OtaSnapshot[], gateway: OtaSnapshot[]) {
  const gatewayById = new Map(gateway.map((item) => [item.externalId, item]));
  const differences: ShadowDifference[] = [];
  const fields: Array<keyof OtaSnapshot> = [
    "unitId", "channel", "checkIn", "checkOut", "status", "grossPrice", "currency",
  ];

  for (const current of source) {
    const candidate = gatewayById.get(current.externalId);
    if (!candidate) {
      differences.push({
        key: `${current.externalId}:missing:gateway`,
        externalId: current.externalId,
        field: "missing",
        sourceValue: current,
      });
      continue;
    }
    for (const field of fields) {
      if (current[field] !== candidate[field]) {
        differences.push({
          key: `${current.externalId}:${field}`,
          externalId: current.externalId,
          field,
          sourceValue: current[field],
          gatewayValue: candidate[field],
        });
      }
    }
    gatewayById.delete(current.externalId);
  }

  for (const candidate of gatewayById.values()) {
    differences.push({
      key: `${candidate.externalId}:missing:source`,
      externalId: candidate.externalId,
      field: "missing",
      gatewayValue: candidate,
    });
  }
  return differences.sort((left, right) => left.key.localeCompare(right.key));
}

function consecutiveCleanDays(reports: DailyShadowReport[]) {
  const unique = [...new Map(reports.map((report) => [report.date, report])).values()]
    .sort((left, right) => right.date.localeCompare(left.date));
  let count = 0;
  for (let index = 0; index < unique.length; index += 1) {
    const report = unique[index];
    if (report.unresolved !== 0 || report.compared === 0) break;
    if (index > 0) {
      const previous = new Date(`${unique[index - 1].date}T00:00:00Z`);
      const current = new Date(`${report.date}T00:00:00Z`);
      if ((previous.getTime() - current.getTime()) / 86_400_000 !== 1) break;
    }
    count += 1;
  }
  return count;
}

export function evaluateGatewayCutover(input: {
  contract?: GatewayContract;
  reports: DailyShadowReport[];
  allActiveRecordsReconciled: boolean;
  rollbackTestedAt?: string;
  ownerApprovedAt?: string;
}) {
  const blockers: string[] = [];
  const contract = input.contract;
  if (!contract?.signedAt) blockers.push("brak podpisanego kontraktu danych i versioningu");
  if (!contract || OTA_REQUIRED_FIELDS.some((field) => !contract.fieldCoverage[field])) {
    blockers.push("niepełna macierz wymaganych pól");
  }
  if (!contract?.rtoMinutes || !contract?.rpoMinutes) blockers.push("brak RTO/RPO");
  if (!input.allActiveRecordsReconciled) blockers.push("nieuzgodnione aktywne rezerwacje, blokady lub salda");
  const cleanDays = consecutiveCleanDays(input.reports);
  if (cleanDays < 7) blockers.push(`shadow mode: ${cleanDays}/7 kolejnych czystych dni`);
  if (!input.rollbackTestedAt) blockers.push("rollback nie został przetestowany");
  if (!input.ownerApprovedAt) blockers.push("brak osobnej akceptacji właściciela");
  return { ready: blockers.length === 0, blockers, cleanDays };
}

export function webhookReplayKey(provider: string, eventId: string) {
  return `${provider.trim().toLowerCase()}:${eventId.trim()}`;
}
