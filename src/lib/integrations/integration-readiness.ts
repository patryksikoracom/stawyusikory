export type IntegrationContractChecklist = {
  fieldContractApproved: boolean;
  sourceOfTruthDefined: boolean;
  idempotencyTested: boolean;
  monitoringConfigured: boolean;
  retentionApproved: boolean;
  rollbackTested: boolean;
};

export function evaluateFurtherIntegration(input: {
  kind: "ads_api" | "meter_api";
  contract: IntegrationContractChecklist;
  stableCsvImports?: number;
  campaignModelApproved?: boolean;
  manualReadings?: number;
  manualPilotApproved?: boolean;
}) {
  const blockers: string[] = [];
  for (const [key, value] of Object.entries(input.contract)) {
    if (!value) blockers.push(`kontrakt: ${key}`);
  }
  if (input.kind === "ads_api") {
    if ((input.stableCsvImports ?? 0) < 3) blockers.push("mniej niż 3 stabilne importy CSV");
    if (!input.campaignModelApproved) blockers.push("model kampanii niezatwierdzony");
  } else {
    if ((input.manualReadings ?? 0) < 30) blockers.push("mniej niż 30 ręcznych odczytów");
    if (!input.manualPilotApproved) blockers.push("brak potwierdzonego zwrotu z pracy pilota");
  }
  return { ready: blockers.length === 0, blockers };
}
