import type { AppData } from "@/lib/types";
import { Card } from "@/components/ui/primitives";
import { evaluateGatewayCutover, OTA_REQUIRED_FIELDS } from "@/lib/integrations/ota-gateway";
import { evaluateFurtherIntegration } from "@/lib/integrations/integration-readiness";

const emptyContract = {
  fieldContractApproved: false,
  sourceOfTruthDefined: false,
  idempotencyTested: false,
  monitoringConfigured: false,
  retentionApproved: false,
  rollbackTested: false,
};

export function IntegrationGoLivePanel({ data }: { data: AppData }) {
  const gateway = evaluateGatewayCutover({
    reports: [],
    allActiveRecordsReconciled: false,
  });
  const stableCsvImports = new Set(data.adSpend.map((record) => record.sourceFile).filter(Boolean)).size;
  const ads = evaluateFurtherIntegration({
    kind: "ads_api",
    contract: emptyContract,
    stableCsvImports,
    campaignModelApproved: false,
  });
  const meters = evaluateFurtherIntegration({
    kind: "meter_api",
    contract: emptyContract,
    manualReadings: data.meterReadings.length,
    manualPilotApproved: false,
  });

  return (
    <section aria-labelledby="integration-go-live-title" className="grid gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#9b4029]">PR-12 · kontrolowany go-live</p>
        <h2 className="font-display text-3xl font-semibold" id="integration-go-live-title">Bramki zamiast przełącznika „włącz”</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#62716a]">
          Mobile Calendar/OTA pozostaje źródłem nadrzędnym. Produkcyjne przełączenie jest zablokowane do czasu
          realnego spike&apos;u dostawców, codziennych raportów shadow mode, testu rollbacku i osobnej akceptacji.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <GateCard
          title="12a · Gateway OTA"
          status={`${gateway.cleanDays}/7 czystych dni`}
          blockers={gateway.blockers}
          details={`Spike: Mobile-Calendar Premium vs Beds24 · pola: ${OTA_REQUIRED_FIELDS.join(", ")}`}
        />
        <GateCard
          title="12b · Dostawa wiadomości"
          status="Dostawa wyłączona"
          blockers={[
            "brak wybranego właściciela i środowisk dostawców",
            "brak potwierdzonego cyklu queued → sent → delivered/rejected",
            "brak testów realnych kanałów i podpisanych webhooków",
          ]}
          details="Rdzeń preflight wymusza E.164, idempotencję, limit retry, backoff i alert. Podpięcie do wybranego dostawcy nadal jest zablokowane."
        />
        <GateCard
          title="12c · Reklamy i liczniki"
          status="Pilotaż danych"
          blockers={[...ads.blockers.slice(-2), ...meters.blockers.slice(-2)]}
          details={`CSV reklam: ${stableCsvImports}/3 stabilne importy · odczyty liczników: ${data.meterReadings.length}/30`}
        />
      </div>
    </section>
  );
}

function GateCard({
  title,
  status,
  blockers,
  details,
}: {
  title: string;
  status: string;
  blockers: string[];
  details: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#ead2c9] bg-[#fff5f1] p-5">
        <p className="text-xs font-black uppercase tracking-[.13em] text-[#9b4029]">{title}</p>
        <p className="mt-2 font-display text-2xl font-semibold">{status}</p>
      </div>
      <div className="p-5">
        <p className="text-xs leading-5 text-[#61716a]">{details}</p>
        <ul className="mt-4 grid gap-2 text-xs font-bold text-[#7f3e2c]">
          {blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
        </ul>
      </div>
    </Card>
  );
}
