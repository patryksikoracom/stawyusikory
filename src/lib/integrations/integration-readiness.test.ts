import { describe, expect, it } from "vitest";
import { evaluateFurtherIntegration } from "./integration-readiness";

const contract = {
  fieldContractApproved: true,
  sourceOfTruthDefined: true,
  idempotencyTested: true,
  monitoringConfigured: true,
  retentionApproved: true,
  rollbackTested: true,
};

describe("further integration gates", () => {
  it("keeps ads API behind stable CSV imports and an approved campaign model", () => {
    expect(evaluateFurtherIntegration({
      kind: "ads_api", contract, stableCsvImports: 2, campaignModelApproved: true,
    }).ready).toBe(false);
    expect(evaluateFurtherIntegration({
      kind: "ads_api", contract, stableCsvImports: 3, campaignModelApproved: true,
    }).ready).toBe(true);
  });

  it("keeps meter API behind the manual pilot and full operational contract", () => {
    expect(evaluateFurtherIntegration({
      kind: "meter_api",
      contract: { ...contract, rollbackTested: false },
      manualReadings: 30,
      manualPilotApproved: true,
    }).blockers).toContain("kontrakt: rollbackTested");
    expect(evaluateFurtherIntegration({
      kind: "meter_api",
      contract,
      manualReadings: 30,
      manualPilotApproved: true,
    }).ready).toBe(true);
  });
});
